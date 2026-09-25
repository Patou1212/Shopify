import type { ReactNode } from "react";
export function Portal({
  active,
  shop,
  children,
}: {
  active: string;
  shop: { name: string | null; domain: string };
  children: ReactNode;
}) {
  return (
    <div className="portal">
      <header className="app-header">
        <a className="wordmark" href="/inventory">
          <span className="brand-mark">S</span>stockify
          <span className="brand-caption">GESTION D’INVENTAIRE</span>
        </a>
        <div className="shop-identity">
          <span className="status-dot" />
          <span>{shop.name || shop.domain}</span>
          <span className="avatar">
            {(shop.name || shop.domain).slice(0, 1)}
          </span>
        </div>
      </header>
      <nav className="portal-nav" aria-label="Navigation principale">
        {[
          ["inventory", "Inventaire", "/inventory"],
          [
            "dashboard",
            "Statistiques",
            `/dashboard?shop=${encodeURIComponent(shop.domain)}`,
          ],
          ["history", "Mouvements de stock", "/history"],
          ["connections", "Connexions", "/audit?tab=connections"],
          ["audit", "Activité produits", "/audit?tab=products"],
          ["settings", "Gestion du compte", "/settings"],
        ].map(([key, label, url]) => (
          <a
            key={key}
            href={url}
            aria-current={active === key ? "page" : undefined}
            className={active === key ? "active" : ""}
          >
            {label}
          </a>
        ))}
      </nav>
      <main className="portal-main">{children}</main>
      <footer className="app-footer">
        Stockify <span>Votre inventaire, en un seul endroit.</span>
      </footer>
    </div>
  );
}
export function StockBadge({ qty }: { qty: number }) {
  return (
    <span
      className={`stock-badge ${qty <= 0 ? "out" : qty <= 3 ? "low" : "in"}`}
    >
      <i />
      {qty <= 0 ? "Rupture" : qty <= 3 ? "Stock faible" : "En stock"}
    </span>
  );
}
