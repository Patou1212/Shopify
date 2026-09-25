import { Portal } from "@/app/components/portal";
import { requireShop } from "@/lib/session";
import { db } from "@/lib/db";
import { SyncButton } from "@/app/inventory/controls";
export default async function Settings() {
  const shop = await requireShop();
  const locations = await db.location.findMany({
    where: { shopId: shop.id },
    orderBy: { name: "asc" },
  });
  return (
    <Portal active="settings" shop={shop}>
      <header className="page-heading">
        <div>
          <span className="eyebrow">VOTRE CONNEXION</span>
          <h1>Gestion du compte</h1>
          <p>La boutique et les magasins associés à votre inventaire.</p>
        </div>
      </header>
      <div className="settings-grid">
        <section className="panel">
          <h2>Boutique Shopify</h2>
          <p>{shop.name || shop.domain}</p>
          <p className="sku">{shop.domain}</p>
          <span className="stock-badge in">
            <i />
            {shop.id === "stockify-local-demo"
              ? "Boutique fictive"
              : "Connectée"}
          </span>
          <hr />
          <SyncButton />
        </section>
        <section className="panel">
          <h2>Magasins</h2>
          {locations.map((l) => (
            <div className="location-setting" key={l.id}>
              <strong>{l.name}</strong>
              <span
                className={`stock-badge ${l.active && !l.excluded ? "in" : "low"}`}
              >
                {l.active && !l.excluded ? "Inclus" : "Non inclus"}
              </span>
            </div>
          ))}
          {!locations.length && (
            <p>Synchronisez Shopify pour retrouver vos magasins.</p>
          )}
        </section>
      </div>
    </Portal>
  );
}
