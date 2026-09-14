import { db } from "@/lib/db";
import { normalizeShopDomain } from "@/lib/shopify/domain";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ shop?: string }> }) {
  const { shop: raw } = await searchParams; const domain = normalizeShopDomain(raw || "");
  const shop = domain ? await db.shop.findUnique({ where:{domain}, include:{ locations:true } }) : null;
  if (!shop) return <main className="landing"><section className="connect-card"><h1>Boutique introuvable</h1><a href="/">Retour à la connexion</a></section></main>;
  const [variants, levels, low, out, preview] = await Promise.all([
    db.variant.count({where:{shopId:shop.id,active:true}}),
    db.inventoryLevel.aggregate({where:{shopId:shop.id,location:{excluded:false}},_sum:{availableQty:true}}),
    db.inventoryLevel.count({where:{shopId:shop.id,availableQty:{gt:0,lte:3},location:{excluded:false}}}),
    db.inventoryLevel.count({where:{shopId:shop.id,availableQty:{lte:0},location:{excluded:false}}}),
    db.inventoryLevel.findMany({where:{shopId:shop.id,location:{excluded:false}},include:{location:true,variant:{include:{product:true}}},take:40,orderBy:{updatedAt:"desc"}})
  ]);
  return <div className="shell"><aside className="sidebar"><div className="brand">STOCKIFY</div><a className="active" href={`/dashboard?shop=${domain}`}>Tableau de bord</a><a href={`/inventory?shop=${domain}`}>Inventaire</a><a href="#">Historique</a><a href="#">Paramètres</a></aside><main className="content"><h1>Bonjour 👋</h1><p>{shop.name || shop.domain} · boutique connectée</p><div className="cards"><div className="card"><div className="muted">Magasins</div><div className="metric">{shop.locations.filter(l=>l.active&&!l.excluded).length}</div></div><div className="card"><div className="muted">Variantes</div><div className="metric">{variants}</div></div><div className="card"><div className="muted">Stock disponible</div><div className="metric">{levels._sum.availableQty || 0}</div></div><div className="card"><div className="muted">Ruptures / faibles</div><div className="metric">{out} / {low}</div></div></div><div className="panel" style={{marginTop:20}}><h2>Aperçu de l'inventaire</h2><div className="table-wrap"><table className="table"><thead><tr><th>Produit</th><th>Variante</th><th>SKU</th><th>Magasin</th><th>Disponible</th></tr></thead><tbody>{preview.map(r=><tr key={r.id}><td>{r.variant.product.title}</td><td>{r.variant.title}</td><td>{r.variant.sku||"—"}</td><td>{r.location.name}</td><td><span className="badge">{r.availableQty}</span></td></tr>)}</tbody></table></div></div></main></div>;
}
