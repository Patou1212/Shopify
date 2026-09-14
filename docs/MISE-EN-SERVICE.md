# Mettre Stockify en service

Le dépôt GitHub contient le code ; une application Shopify et un serveur avec PostgreSQL restent nécessaires pour utiliser une boutique réelle.

## 1. Préparer le Mac

Installer Node.js 22 et Docker Desktop, puis ouvrir le dossier du projet dans un terminal. Installer pnpm avec `npm install --global pnpm@11.19.0`.

```sh
pnpm install --frozen-lockfile
pnpm setup:local
docker compose up -d --wait
pnpm db:generate
pnpm db:deploy
pnpm dev
```

Ouvrir http://localhost:3000. La page de connexion peut être affichée avant de configurer Shopify. Le script de préparation crée `.env` avec des secrets aléatoires, sans les afficher et sans remplacer un fichier existant. Ne pas modifier le mot de passe PostgreSQL après l'initialisation du volume sans effectuer aussi sa rotation dans PostgreSQL.

## 2. Préparer le serveur public

Choisir un hébergement capable d'exécuter un serveur Node.js de longue durée ou le Dockerfile fourni, ainsi qu'une base PostgreSQL persistante. La synchronisation actuelle reste exécutée dans la requête et n'est pas adaptée aux limites courtes de certaines fonctions serverless.

Construire avec `pnpm install --frozen-lockfile && pnpm build`, puis démarrer avec `pnpm start`. Pour Docker : `docker build -t stockify .`, puis lancer l'image avec les variables d'environnement configurées par l'hébergeur. Le fichier `.env` est exclu de l'image.

Configurer DATABASE_URL avec la base hébergée et APP_URL avec l'origine HTTPS du site (sans chemin). Utiliser une clé APP_ENCRYPTION_KEY stable de 32 octets encodée en base64 ; la conserver, car son remplacement empêche de déchiffrer les jetons existants. Le Compose fourni sert uniquement à PostgreSQL local.

Appliquer `pnpm db:deploy` avant de démarrer la nouvelle version. Avec Docker, exécuter la même image une fois avec la commande `pnpm db:deploy` et les mêmes variables. Pour une base déjà créée avec `db push`, suivre la procédure baseline du README, pas une réinitialisation.

## 3. Créer l'application Shopify

Dans https://dev.shopify.com/dashboard, créer une application nommée Stockify. Configurer une version avec :

| Champ | Valeur |
| --- | --- |
| App URL | L'origine HTTPS de votre hébergement |
| Embedded app | Désactivé : Stockify est une application indépendante |
| Redirect URL | L'origine HTTPS suivie de `/api/shopify/callback` |
| Scopes | `read_products,read_inventory,write_inventory,read_locations` |

Publier la version et configurer la distribution/installation appropriée à votre boutique. Reporter le Client ID et le Client Secret dans SHOPIFY_CLIENT_ID et SHOPIFY_CLIENT_SECRET chez l'hébergeur (ou dans `.env` local). Garder SHOPIFY_API_VERSION à `2026-07`.

Pour tester le Mac avec Shopify, utiliser une URL HTTPS de tunnel vers le port 3000 et renseigner cette même origine dans APP_URL et les URL Shopify. Redémarrer le serveur après changement de configuration.

Guide Shopify : https://shopify.dev/docs/apps/build/dev-dashboard/create-apps-using-dev-dashboard

## 4. Vérifier et connecter

Exécuter `pnpm config:check`. Ce contrôle valide la configuration, pas les identifiants auprès de Shopify. Vérifier `/api/health` : HTTP 200 signifie que le serveur peut interroger le schéma PostgreSQL ; HTTP 503 indique un problème de base ou de migration sans divulguer les détails.

Ouvrir Stockify, saisir le domaine `votre-boutique.myshopify.com`, puis autoriser les accès dans Shopify. Dans Inventaire, lancer Synchroniser Shopify. Comparer un produit et chaque emplacement avec l'administration Shopify : disponible et physique peuvent être différents.

Faire le premier ajustement uniquement sur un article de test, contrôler le résultat dans Shopify et dans Historique, puis compenser si nécessaire avec un second ajustement. Les tests automatiques n'agissent jamais sur les stocks réels.

## Vérifications automatiques

Le workflow GitHub applique les migrations sur PostgreSQL 16, exécute les tests, compile le projet et vérifie `/api/health`. Son exécution sur GitHub reste à confirmer après publication de cette branche. Docker n'était pas installé sur le Mac lors de la préparation : l'image n'y a pas été construite.
