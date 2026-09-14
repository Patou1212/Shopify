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
        : {}),
  };
  const where = {
    shopId: shop.id,
    variants: { some: { active: true, inventoryLevels: { some: levelWhere } } },
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            {
              variants: {
                some: {
                  OR: ["sku", "barcode", "title"].map((field) => ({
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
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">STOCKIFY</div>
        <a href={`/dashboard?shop=${shop.domain}`}>Tableau de bord</a>
        <a className="active" href="/inventory">
          Inventaire
        </a>
        <a href="/history">Historique</a>
      </aside>
      <main className="content">
        <h1>Inventaire</h1>
        <p>
          {shop.name || shop.domain} ·{" "}
          {shop.lastSyncedAt
            ? `Synchronisé le ${shop.lastSyncedAt.toLocaleString("fr-FR")}`
            : "Première synchronisation nécessaire"}
        </p>
        <SyncButton />
        <form className="toolbar">
          <input
            name="q"
            aria-label="Recherche"
            defaultValue={q}
            placeholder="Produit, variante, SKU, code-barres"
          />
          <select
            name="location"
            aria-label="Emplacement"
            defaultValue={p.location || ""}
          >
            <option value="">Tous les emplacements</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <select
            name="status"
            aria-label="Stock"
            defaultValue={p.status || "all"}
          >
            <option value="all">Tous les stocks</option>
            <option value="low">Faible (1–3)</option>
            <option value="out">Rupture (≤ 0)</option>
          </select>
          <select
            name="view"
            aria-label="Affichage"
            defaultValue={p.view || "matrix"}
          >
            <option value="matrix">Matrice tailles / couleurs</option>
            <option value="list">Liste</option>
          </select>
          <button>Filtrer</button>
        </form>
        <p>
          {count} produits · page {page}
        </p>
        {!products.length && (
          <p>
            Aucun stock correspondant. Synchronisez la boutique ou modifiez les
            filtres.
          </p>
        )}
        {products.map((product) => (
          <section className="panel" key={product.id}>
            <h2>{product.title}</h2>
            {p.view === "list" ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Variante / SKU</th>
                      <th>Emplacement</th>
                      <th>Disponible</th>
                      <th>Physique</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.variants.flatMap((v) =>
                      v.inventoryLevels.map((l) => (
                        <tr key={l.id}>
                          <td>
                            {v.title} · {v.sku || "Sans SKU"}
                          </td>
                          <td>{l.location.name}</td>
                          <td>{l.availableQty}</td>
                          <td>{l.onHandQty}</td>
                          <td>
                            <Adjustment
                              variantId={v.id}
                              locationId={l.locationId}
                            />
                          </td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              locations
                .filter((loc) =>
                  product.variants.some((v) =>
                    v.inventoryLevels.some((l) => l.locationId === loc.id),
                  ),
                )
                .map((loc) => {
                  const variants = product.variants.filter((v) =>
                    v.inventoryLevels.some((l) => l.locationId === loc.id),
                  );
                  const sizes = [
                    ...new Set(
                      variants.map((v) => v.optionSize || "Sans taille"),
                    ),
                  ].sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
                  const colors = [
                    ...new Set(
                      variants.map((v) => v.optionColor || "Sans couleur"),
                    ),
                  ];
                  return (
                    <div className="table-wrap" key={loc.id}>
                      <h3>{loc.name}</h3>
                      <p>
                        Disponible / physique · chaque variante reste distincte.
                      </p>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Couleur / Taille</th>
                            {sizes.map((s) => (
                              <th key={s}>{s}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {colors.map((color) => (
                            <tr key={color}>
                              <th>{color}</th>
                              {sizes.map((s) => (
                                <td key={s}>
                                  {variants
                                    .filter(
                                      (v) =>
                                        (v.optionSize || "Sans taille") === s &&
                                        (v.optionColor || "Sans couleur") ===
                                          color,
                                    )
                                    .map((v) => {
                                      const l = v.inventoryLevels.find(
                                        (l) => l.locationId === loc.id,
                                      )!;
                                      return (
                                        <div key={v.id}>
                                          <small>{v.sku || v.title}</small>
                                          <p>
                                            <strong>{l.availableQty}</strong> /{" "}
                                            {l.onHandQty}
                                          </p>
                                          <Adjustment
                                            variantId={v.id}
                                            locationId={loc.id}
                                          />
                                        </div>
                                      );
                                    })}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })
            )}
          </section>
        ))}
        <nav aria-label="Pagination">
          {page > 1 && <a href={href(page - 1)}>← Précédent</a>}{" "}
          {page * size < count && <a href={href(page + 1)}>Suivant →</a>}
        </nav>
      </main>
    </div>
  );
}
