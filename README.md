# Stockify App

Application web indépendante de WordPress pour gérer l'inventaire d'une boutique Shopify.

## Stack
- Next.js / React / TypeScript
- PostgreSQL + Prisma
- Shopify GraphQL Admin API

## Démarrage
```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate -- --name init
npm run dev
```

Configurer dans `.env` les identifiants de l'application Shopify et une base PostgreSQL. Le callback OAuth est `APP_URL/api/shopify/callback`.

## État du développement
- Connexion OAuth Shopify
- Token Shopify chiffré côté serveur
- Modèle de données multi-boutiques
- Dashboard
- Écran Inventaire avec recherche et filtres rupture/stock faible
- Structure prête pour synchronisation magasins, produits, variantes et stocks

Prochaine phase : finaliser la synchronisation GraphQL, modification de stock, historique et webhooks.
