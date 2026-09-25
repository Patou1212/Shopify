import { Portal, StockBadge } from "@/app/components/portal";
import { db } from "@/lib/db";
import { requireShop } from "@/lib/session";
import { SyncButton, Adjustment } from "./controls";
export default async function Inventory({
  searchParams,
}: {
  searchParams: Promise<{
    shop?: string;
    q?: string;
    status?: string;
    location?: string;
    page?: string;
    view?: string;
  }>;
}) {
  const p = await searchParams;
  const shop = await requireShop(p.shop);
  const q = (p.q || "").trim();
  const page = Math.max(1, Math.min(100000, Math.floor(Number(p.page) || 1)));
  const size = 25;
  const locations = await db.location.findMany({
    where: { shopId: shop.id, active: true, excluded: false },
    orderBy: { name: "asc" },
  });
  const levelWhere = {
    shopId: shop.id,
    location: { active: true, excluded: false },
    ...(p.location ? { locationId: p.location } : {}),
    ...(p.status === "out"
      ? { availableQty: { lte: 0 } }
      : p.status === "low"
        ? { availableQty: { gt: 0, lte: 3 } }
        : p.status === "in"
          ? { availableQty: { gt: 3 } }
          : {}),
  };
  const where = {
    shopId: shop.id,
    variants: { some: { active: true, inventoryLevels: { some: levelWhere } } },
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { family: { contains: q, mode: "insensitive" as const } },
            { productType: { contains: q, mode: "insensitive" as const } },
            {
              variants: {
                some: {
                  OR: [
                    "sku",
                    "barcode",
                    "title",
                    "optionSize",
                    "optionColor",
                  ].map((field) => ({
                    [field]: { contains: q, mode: "insensitive" as const },
                  })),
                },
              },
            },
          ],
        }
      : {}),
  };
  const [count, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      skip: (Math.floor(page) - 1) * size,
      take: size,
      orderBy: [{ title: "asc" }, { id: "asc" }],
      include: {
        variants: {
          where: { active: true },
          include: {
            inventoryLevels: { where: levelWhere, include: { location: true } },
          },
        },
      },
    }),
  ]);
  const href = (next: number) =>
    `/inventory?${new URLSearchParams({ ...Object.fromEntries(Object.entries(p).filter((e): e is [string, string] => typeof e[1] === "string")), page: String(next) })}`;
  const scope = {
    shopId: shop.id,
    variant: { active: true },
    location: { active: true, excluded: false },
    ...(p.location ? { locationId: p.location } : {}),
  };
  const [stock, alerts, totalProducts, families] = await Promise.all([
    db.inventoryLevel.aggregate({
      where: scope,
      _sum: { availableQty: true, onHandQty: true },
    }),
    db.inventoryLevel.count({ where: { ...scope, availableQty: { lte: 3 } } }),
    db.product.count({
      where: {
        shopId: shop.id,
        variants: { some: { active: true, inventoryLevels: { some: scope } } },
      },
    }),
    db.product.findMany({
      where: {
        shopId: shop.id,
        variants: { some: { active: true, inventoryLevels: { some: scope } } },
      },
      select: { family: true, productType: true },
      distinct: ["family", "productType"],
    }),
  ]);
  const familyNames = new Set(
    families.map((f) => f.family || f.productType || "Sans catégorie"),
  );
  const groups = new Map<string, typeof products>();
  for (const product of products) {
    const key = product.family || product.productType || "Sans catégorie";
    groups.set(key, [...(groups.get(key) || []), product]);
  }
  const view =
    p.view === "list" ? "list" : p.view === "grid" ? "grid" : "matrix";
  const link = (nextView: string) =>
    `/inventory?${new URLSearchParams({ ...Object.fromEntries(Object.entries(p).filter((e): e is [string, string] => typeof e[1] === "string")), view: nextView, page: "1" })}`;
  const sizeOrder = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"];
  const sortSize = (a: string, b: string) => {
    const ai = sizeOrder.indexOf(a.toUpperCase()),
      bi = sizeOrder.indexOf(b.toUpperCase());
    return ai >= 0 && bi >= 0
      ? ai - bi
      : a.localeCompare(b, "fr", { numeric: true });
  };
  return (
    <Portal active="inventory" shop={shop}>
      <header className="page-heading">
        <div>
          <span className="eyebrow">VOTRE ESPACE DE GESTION</span>
          <h1>Inventaire</h1>
          <p>
            Retrouvez vos produits, suivez les quantités et ajustez vos stocks.
          </p>
        </div>
        <SyncButton />
      </header>
      <div className="inventory-stats">
        {[
          ["Familles", familyNames.size, "catégories de produits"],
          ["Produits", totalProducts, "références en inventaire"],
          [
            "Stock disponible",
            stock._sum.availableQty || 0,
            `${stock._sum.onHandQty || 0} unités physiques`,
          ],
          ["Alertes stock", alerts, "variantes par magasin · seuil 3"],
        ].map(([label, value, hint], i) => (
          <div
            className={`stat-tile ${i === 3 ? "alert-tile" : ""}`}
            key={label}
          >
            <span>{label}</span>
            <strong>{Number(value).toLocaleString("fr-FR")}</strong>
            <small>{hint}</small>
          </div>
        ))}
      </div>
      <section
        className="inventory-workspace"
        aria-label="Produits en inventaire"
      >
        <div className="workspace-heading">
          <div>
            <h2>Vos produits</h2>
            <span>Regroupés par famille, puis par magasin</span>
          </div>
          <div className="view-switch" aria-label="Vue de l’inventaire">
            {[
              ["matrix", "Matrice"],
              ["list", "Liste"],
              ["grid", "Cartes"],
            ].map(([key, label]) => (
              <a
                key={key}
                className={view === key ? "active" : ""}
                href={link(key)}
                aria-current={view === key ? "page" : undefined}
              >
                {label}
              </a>
            ))}
          </div>
        </div>
        <form className="filter-bar">
          <input type="hidden" name="view" value={view} />
          <label className="search-control">
            <span>Recherche</span>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Famille, produit, SKU, taille, couleur…"
            />
          </label>
          <label>
            <span>Magasin</span>
            <select name="location" defaultValue={p.location || ""}>
              <option value="">Tous les magasins</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Statut</span>
            <select name="status" defaultValue={p.status || "all"}>
              <option value="all">Tous les stocks</option>
              <option value="in">En stock (&gt; 3)</option>
              <option value="low">Stock faible (1–3)</option>
              <option value="out">Rupture (≤ 0)</option>
            </select>
          </label>
          <button type="submit">Appliquer</button>
          <a className="reset-link" href="/inventory">
            Réinitialiser
          </a>
        </form>
        <div className="results-meta">
          <span>
            <strong>{count}</strong> produit{count > 1 ? "s" : ""} correspondant
            {count > 1 ? "s" : ""}
          </span>
          <span>
            Dernière synchronisation :{" "}
            {shop.lastSyncedAt
              ? shop.lastSyncedAt.toLocaleString("fr-FR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "à effectuer"}
          </span>
        </div>
        {!products.length && (
          <div className="empty-state">
            <h3>Aucun produit trouvé</h3>
            <p>Essayez d’autres filtres ou synchronisez votre boutique.</p>
            <a href="/inventory">Effacer les filtres</a>
          </div>
        )}
        {[...groups].map(([family, items], familyIndex) => (
          <details
            className="family-section"
            key={family}
            open={familyIndex === 0}
          >
            <summary className="family-heading">
              <span className="family-icon" aria-hidden="true">
                ▦
              </span>
              <div>
                <span className="eyebrow">FAMILLE</span>
                <h3>{family}</h3>
              </div>
              <span className="count-chip">
                {items.length} produits sur cette page
              </span>
              <span className="disclosure">⌄</span>
            </summary>
            <div
              className={`product-collection ${view === "grid" ? "product-grid" : ""}`}
            >
              {items.map((product, productIndex) => {
                const levels = product.variants.flatMap(
                  (v) => v.inventoryLevels,
                );
                const available = levels.reduce(
                  (a, l) => a + l.availableQty,
                  0,
                );
                const physical = levels.reduce((a, l) => a + l.onHandQty, 0);
                const alertCount = levels.filter(
                  (l) => l.availableQty <= 3,
                ).length;
                return (
                  <details
                    className="product-section"
                    key={product.id}
                    open={view !== "grid" && productIndex === 0}
                  >
                    <summary className="product-heading">
                      <div className="product-monogram">
                        {product.title.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="product-title">
                        <h3>{product.title}</h3>
                        <span>
                          {product.variants.length} variantes ·{" "}
                          {new Set(levels.map((l) => l.locationId)).size}{" "}
                          magasins
                        </span>
                      </div>
                      <div className="product-totals">
                        <strong>
                          {available}
                          <small>disponibles</small>
                        </strong>
                        <span>
                          {physical}
                          <small>physiques</small>
                        </span>
                      </div>
                      <span
                        className={`stock-badge ${alertCount ? "low" : "in"}`}
                      >
                        <i />
                        {alertCount ? `${alertCount} alertes` : "En stock"}
                      </span>
                      <span className="disclosure">⌄</span>
                    </summary>
                    <div className="product-body">
                      {locations
                        .filter((loc) =>
                          levels.some((l) => l.locationId === loc.id),
                        )
                        .map((loc) => {
                          const variants = product.variants.filter((v) =>
                            v.inventoryLevels.some(
                              (l) => l.locationId === loc.id,
                            ),
                          );
                          const sizes = [
                            ...new Set(
                              variants.map((v) => v.optionSize || "Unique"),
                            ),
                          ].sort(sortSize);
                          const colors = [
                            ...new Set(
                              variants.map(
                                (v) => v.optionColor || "Sans couleur",
                              ),
                            ),
                          ];
                          return (
                            <section className="location-section" key={loc.id}>
                              <div className="location-heading">
                                <h4>
                                  <span aria-hidden="true">⌂</span> {loc.name}
                                </h4>
                                <span>Disponible / physique</span>
                              </div>
                              <div className="table-wrap">
                                {view === "list" ? (
                                  <table className="table">
                                    <thead>
                                      <tr>
                                        <th>Variante</th>
                                        <th>SKU</th>
                                        <th>Disponible</th>
                                        <th>Physique</th>
                                        <th>Statut</th>
                                        <th />
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {variants.map((v) => {
                                        const l = v.inventoryLevels.find(
                                          (l) => l.locationId === loc.id,
                                        )!;
                                        return (
                                          <tr key={v.id}>
                                            <td>
                                              <strong>{v.title}</strong>
                                            </td>
                                            <td className="sku">
                                              {v.sku || "—"}
                                            </td>
                                            <td>
                                              <strong>{l.availableQty}</strong>
                                            </td>
                                            <td>{l.onHandQty}</td>
                                            <td>
                                              <StockBadge
                                                qty={l.availableQty}
                                              />
                                            </td>
                                            <td>
                                              <Adjustment
                                                variantId={v.id}
                                                locationId={loc.id}
                                                label={`${product.title} · ${v.title}`}
                                                current={l.availableQty}
                                              />
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                ) : (
                                  <table className="table matrix-table">
                                    <thead>
                                      <tr>
                                        <th>Couleur / Taille</th>
                                        {sizes.map((size) => (
                                          <th key={size}>{size}</th>
                                        ))}
                                        <th>Total dispo.</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {colors.map((color) => (
                                        <tr key={color}>
                                          <th>
                                            <span
                                              className="color-dot"
                                              style={{
                                                background:
                                                  color.toLowerCase() === "bleu"
                                                    ? "#496b94"
                                                    : color.toLowerCase() ===
                                                        "noir"
                                                      ? "#343434"
                                                      : "#d6b6a6",
                                              }}
                                            />
                                            {color}
                                          </th>
                                          {sizes.map((size) => {
                                            const matches = variants.filter(
                                              (v) =>
                                                (v.optionSize || "Unique") ===
                                                  size &&
                                                (v.optionColor ||
                                                  "Sans couleur") === color,
                                            );
                                            return (
                                              <td key={size}>
                                                {!matches.length
                                                  ? "—"
                                                  : matches.map((v) => {
                                                      const l =
                                                        v.inventoryLevels.find(
                                                          (l) =>
                                                            l.locationId ===
                                                            loc.id,
                                                        )!;
                                                      return (
                                                        <div
                                                          className={`quantity-cell ${l.availableQty <= 0 ? "quantity-out" : l.availableQty <= 3 ? "quantity-low" : ""}`}
                                                          key={v.id}
                                                        >
                                                          <div>
                                                            <strong>
                                                              {l.availableQty}
                                                            </strong>
                                                            <span>
                                                              {" "}
                                                              / {l.onHandQty}
                                                            </span>
                                                          </div>
                                                          <small>
                                                            {v.sku || v.title}
                                                          </small>
                                                          <Adjustment
                                                            variantId={v.id}
                                                            locationId={loc.id}
                                                            label={`${product.title} · ${v.title}`}
                                                            current={
                                                              l.availableQty
                                                            }
                                                          />
                                                        </div>
                                                      );
                                                    })}
                                              </td>
                                            );
                                          })}
                                          <td className="row-total">
                                            {variants
                                              .filter(
                                                (v) =>
                                                  (v.optionColor ||
                                                    "Sans couleur") === color,
                                              )
                                              .reduce(
                                                (a, v) =>
                                                  a +
                                                  (v.inventoryLevels.find(
                                                    (l) =>
                                                      l.locationId === loc.id,
                                                  )?.availableQty || 0),
                                                0,
                                              )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </section>
                          );
                        })}
                    </div>
                  </details>
                );
              })}
            </div>
          </details>
        ))}
        <div className="inventory-bottom">
          <span>Les totaux produits reflètent les filtres actifs.</span>
          <nav aria-label="Pagination">
            {page > 1 && <a href={href(page - 1)}>← Précédent</a>}
            <span>
              Page {page} / {Math.max(1, Math.ceil(count / size))}
            </span>
            {page * size < count && <a href={href(page + 1)}>Suivant →</a>}
          </nav>
        </div>
      </section>
    </Portal>
  );
}
