import {demoEnabled} from "@/lib/demo";
import {openDemo} from "./demo-action";
export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="landing"><section className="connect-card"><div className="brand">STOCKIFY</div>{demoEnabled() && <form action={openDemo}><p>Démonstration locale · données fictives</p><button>Ouvrir la démonstration</button></form>}<h1>Votre inventaire Shopify, simplement.</h1><p>Connectez votre boutique pour synchroniser vos produits, variantes, magasins et niveaux de stock.</p>{error && <div className="error">Connexion impossible : {error}</div>}<form action="/api/shopify/connect" method="get"><label htmlFor="shop">Domaine Shopify</label><div className="connect-row"><input id="shop" name="shop" placeholder="ma-boutique.myshopify.com" required/><button type="submit">Connecter Shopify</button></div></form><small>Stockify ne stocke jamais votre secret Shopify dans le navigateur.</small></section></main>;
}
