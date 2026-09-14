# Stockify

Application indépendante Next.js 15 + TypeScript + Prisma 6 / PostgreSQL, Shopify Admin GraphQL 2026-07.

## Installation

```sh
cp .env.example .env
pnpm install
pnpm db:generate
pnpm exec prisma migrate deploy
pnpm dev
```

Renseigner DATABASE_URL, APP_URL, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET et APP_ENCRYPTION_KEY (32 octets aléatoires encodés en base64). Aucun secret n'est livré. Le callback OAuth est `APP_URL/api/shopify/callback`. Les scopes nécessaires sont `read_products,read_inventory,write_inventory,read_locations`.

Si une base contient déjà le socle créé avec `db push`, vérifier que son schéma correspond à la migration baseline puis marquer uniquement celle-ci comme appliquée avant `migrate deploy` :

```sh
pnpm exec prisma migrate resolve --applied 202609140001_baseline
pnpm exec prisma migrate deploy
```

Ne pas exécuter cette commande de baseline sur une base vide. Les nouveaux champs sont ajoutés sans suppression des anciens ajustements.

## Fonctionnalités

- Session chiffrée, cookie HttpOnly SameSite=Lax de 24 h créé après OAuth ; chaque lecture et action vérifie la boutique autorisée. Reconnecter les boutiques déjà installées pour obtenir la session.
- Bouton Synchroniser Shopify : pagination complète des emplacements (inactifs compris), variantes et niveaux par inventory item. Produits importés via leurs variantes ; options reconnues en français et anglais. available et on_hand restent distincts.
- Publication atomique du snapshot après récupération complète. Les variantes absentes sont désactivées ; les niveaux absents sont retirés, et les ajustements restent conservés. Un verrou PostgreSQL par boutique évite les opérations Stockify concurrentes.
- Inventaire paginé par produit, recherche produit/variante/SKU/code-barres, filtre par emplacement et rupture/stock faible, liste et matrice taille-couleur par emplacement. Plusieurs variantes dans une même cellule restent distinctes.
- Ajustements signés (+ / −) de disponible avec motif, contrôle Shopify de la quantité attendue (`changeFromQuantity`) et clé `@idempotent`. Un stock local périmé est refusé : synchroniser puis créer une nouvelle demande.
- Historique paginé des opérations Stockify, avec état appliqué/refusé/en attente. Une demande incertaine peut être reprise depuis l'historique avec la même clé pendant une heure ; passé ce délai, vérifier manuellement dans Shopify avant toute nouvelle opération. Les quantités avant/après confirmées proviennent de Shopify.

## Vérification

```sh
pnpm test
pnpm exec tsc --noEmit
pnpm build
```

Les tests couvrent pagination, options, quantités manquantes, snapshot incomplet, isolation boutique, répétition d'ajustement, conflit de stock et réponse réseau incertaine. Aucun test ne modifie une boutique réelle.

## Exploitation et limites

La synchronisation est manuelle et s'exécute dans la requête serveur. Prévoir un serveur Next.js de longue durée ; pour de grands catalogues, porter l'orchestration vers une file de tâches et les Bulk Operations Shopify avant une exploitation à grande échelle. Le snapshot distant est parcouru dans le temps : une vente Shopify peut intervenir pendant la lecture ; les ajustements protègent contre ce décalage par CAS.

L'historique couvre les opérations faites ici, pas les mouvements externes. Les webhooks et la synchronisation planifiée ne sont pas inclus. Les erreurs après un succès Shopify conservent la demande pour reprise ; si la relecture des quantités échoue, resynchroniser l'inventaire. L'identité de l'auteur est actuellement la session boutique, sans comptes employés distincts.

Références : [inventoryAdjustQuantities](https://shopify.dev/docs/api/admin-graphql/latest/mutations/inventoryAdjustQuantities), [InventoryChangeInput](https://shopify.dev/docs/api/admin-graphql/latest/input-objects/InventoryChangeInput).
