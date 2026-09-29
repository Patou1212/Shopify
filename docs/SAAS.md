# Première version des comptes Stockify

Cette version ajoute des espaces clients isolés, des comptes sur invitation, trois rôles et un quota de boutiques Shopify par espace. L’administrateur gère les offres manuellement. Aucun paiement n’est déclenché. Les plugins WordPress/WooCommerce et l’intégration dans Shopify restent à développer.

## Activation progressive

Le mode existant reste actif tant que `STOCKIFY_SAAS=true` n’est pas défini. Ne pas ouvrir commercialement le mode historique : il n’isole pas des comptes clients.

1. Sauvegarder PostgreSQL et le fichier de configuration privé. Tester la restauration.
2. Construire la nouvelle image et appliquer `pnpm db:deploy` avec la bonne `DATABASE_URL`. La migration est additive : aucune boutique ni donnée de stock n’est supprimée.
3. Avec l’environnement serveur chargé, exécuter `node scripts/saas-admin.mjs bootstrap EMAIL NOM`. Le script crée le premier administrateur et affiche un lien privé d’activation valable 24 h. Il refuse de promouvoir un compte client existant et refuse un deuxième bootstrap.
4. Définir `STOCKIFY_SAAS=true` dans l’environnement de l’application et **recréer** le conteneur avec son fichier d’environnement. Un simple `docker restart` ne recharge pas les variables.
5. Ouvrir le lien d’activation, choisir son mot de passe (12 caractères minimum), puis ouvrir `/admin`.
6. Créer un espace client avec une offre et un quota. Transmettre manuellement son lien d’invitation au destinataire (aucun e-mail automatique).
7. Pour une boutique historique, vérifier son propriétaire, puis exécuter `node scripts/saas-admin.mjs assign-shop DOMAINE ESPACE_ID`. L’identifiant de l’espace est visible dans `/admin`. Aucun transfert entre clients n’est permis par cette commande. Les boutiques historiques non rattachées restent inaccessibles en mode SaaS.
8. Pour une nouvelle boutique, son propriétaire utilise « Lier la boutique » depuis `/account`. Le callback OAuth reste `/api/shopify/callback` sur l’URL publique de Stockify.

Avec Docker, les scripts peuvent être lancés par `docker exec -it stockify-app node scripts/saas-admin.mjs ...` une fois l’image mise à jour. Les scripts ne chargent pas eux-mêmes `.env` : en local, utiliser `node --env-file=.env scripts/saas-admin.mjs ...`.

Ne pas désactiver le mode SaaS après ouverture aux clients : cela réactiverait l’authentification historique par boutique.

## Droits

- Propriétaire : connecter les boutiques, inviter des gestionnaires/lecteurs, consulter et ajuster le stock.
- Gestionnaire : consulter, synchroniser et ajuster le stock.
- Lecteur : consulter uniquement. Les mutations sont refusées côté serveur.
- Administrateur plateforme : créer les espaces, changer leur offre/quota, suspendre leur accès. Ce rôle ne donne pas automatiquement accès aux stocks des clients.

Toutes les boutiques rattachées comptent dans le quota, même déconnectées. Une reconnexion ne consomme pas de place supplémentaire. Une baisse du quota n’efface aucune boutique ; elle bloque les nouveaux rattachements. Les connexions concurrentes verrouillent l’espace pour éviter de dépasser le quota. Les alias Shopify sont identifiés par l’identifiant Shopify de la boutique.

## Exploitation et limites

- Sessions opaques conservées sous forme de hash, valables 24 h. Déconnexion avec révocation côté serveur.
- Invitations à usage unique, 24 h. Un utilisateur existant doit se connecter pour accepter ; une invitation ne remplace jamais son mot de passe.
- En cas d’oubli, après vérification de l’identité du titulaire par l’opérateur : `node scripts/saas-admin.mjs reset-password EMAIL`. Révoque ses sessions et invitations, puis émet un lien d’activation privé.
- Les ouvertures de boutiques et ajustements réalisés depuis Stockify identifient le compte. Les modifications effectuées directement dans Shopify ne révèlent pas automatiquement le salarié responsable.
- Nettoyer périodiquement les sessions/invitations expirées et les lignes `AuthThrottle` dont `resetAt` est passé. Ne pas supprimer les journaux sans politique de conservation.
- Avant commercialisation : e-mails transactionnels, parcours de récupération autonome, gestion complète des membres, facturation conforme aux canaux de distribution, MFA administrateur, supervision, sauvegardes et validation de charge sont encore à prévoir.
- Les listes d’administration présentent les 100 espaces les plus récents et les 30 dernières actions.

## Vérifications

`pnpm test`, `pnpm exec tsc --noEmit`, `pnpm build`.

La migration et les scénarios simultanés doivent également être validés sur une base PostgreSQL de recette avant activation en production. Les tests unitaires ne remplacent pas cette vérification.


## Parcours autonome gratuit

En mode SaaS, `/account/register` crée le compte, son espace « Accès découverte » et son rôle propriétaire dans une transaction unique. Le quota est défini côté serveur par `STOCKIFY_FREE_SHOP_LIMIT` (1 par défaut, entre 1 et 100). Le client ne peut pas le choisir. `STOCKIFY_PUBLIC_SIGNUP=false` ferme les inscriptions ; elles sont ouvertes par défaut en mode SaaS. Aucun paiement ni e-mail automatique n’est envoyé. La vérification de possession de l’adresse e-mail et la récupération autonome restent à ajouter avant ouverture commerciale ; l’interface ne prétend pas vérifier l’e-mail.

Une adresse déjà enregistrée, y compris par invitation, ne peut pas être revendiquée via l’inscription publique. La création ne rattache aucune boutique historique et ne donne jamais le rôle administrateur. Limitation des créations : 10 tentatives par adresse et 10 globalement par fenêtre de 15 minutes pour cette phase de test.

Parcours : inscription → domaine Shopify → autorisation Shopify → retour à « Mes boutiques » → lancement explicite de l’import → inventaire. L’import affiche un état d’attente réel, sans pourcentage fictif ; en cas d’erreur, un bouton permet de réessayer. Une boutique déjà importée s’ouvre directement. Les lecteurs ne peuvent pas lancer d’import.

Sur le serveur de test, l’application Shopify doit autoriser exactement l’URL de retour HTTPS de test `/api/shopify/callback` pour tester une nouvelle connexion. Utiliser une boutique Shopify de développement et une application dédiée au test. La copie de base peut contenir des jetons de production : ne pas effectuer d’ajustements depuis la recette. Les boutiques historiques doivent toujours être attribuées explicitement ; aucun mécanisme de récupération par un inconnu n’est ajouté.

Cette évolution ne nécessite pas de nouvelle migration après `202609280001_saas`. Construire une nouvelle image et recréer le conteneur de test pour voir les nouveaux écrans.


## Connexion multi-clients Shopify

Chaque boutique conserve son propre domaine, identifiant Shopify, jeton chiffré et rattachement à un espace. Le Client ID et le secret identifient l’application Stockify centrale, pas le marchand. Le marchand autorise l’application via OAuth avec son propre compte Shopify ; aucun champ de mot de passe Shopify ni de secret API marchand ne doit être ajouté au parcours standard.

Le mode de distribution doit être validé dans le Dev Dashboard avant de proposer Stockify à des clients indépendants. Une distribution personnalisée cible une boutique ou une organisation Shopify Plus ; une distribution publique est destinée à plusieurs marchands et implique les exigences de publication Shopify. Ne pas confondre la publication d’une version dans le Dev Dashboard et l’autorisation de distribuer à tous les marchands.

Vérifier aussi l’URL d’application, la liste exacte des URL de retour (production et, pour une application dédiée, recette), les portées demandées et les droits d’installation du marchand. Guide client intégré : `/account/help/shopify`.

Références officielles :
- https://shopify.dev/docs/apps/build/authentication-authorization/authenticate-standalone-apps
- https://shopify.dev/docs/apps/launch/distribution
