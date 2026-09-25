"use client";
import { useMemo, useState } from "react";
import { StockBadge } from "@/app/components/portal";

type Row = {
  id: string;
  productId: string;
  variantId: string;
  product: string;
  family: string;
  variant: string;
  sku: string;
  barcode: string;
  size: string;
  color: string;
  location: string;
  locationId: string;
  available: number;
  physical: number;
  synced: string;
};
type Dimension = "family" | "product" | "location" | "size" | "color";
const n = (v: number) => v.toLocaleString("fr-FR");
const date = (v: string) =>
  new Date(v).toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
const sum = (rows: Row[], key: "available" | "physical") =>
  rows.reduce((s, r) => s + r[key], 0);
function Table({ rows }: { rows: Row[] }) {
  return (
    <div className="table-wrap">
      <table className="table studio-table">
        <thead>
          <tr>
            {[
              "Produit / variante",
              "SKU / code-barres",
              "Famille",
              "Magasin",
              "Taille",
              "Couleur",
              "Disponible",
              "Physique",
              "Écart¹",
              "État",
              "Synchronisé le",
            ].map((t) => (
              <th key={t}>{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <strong>{r.product}</strong>
                <small>{r.variant}</small>
              </td>
              <td>
                {r.sku || "—"}
                <small>{r.barcode || "—"}</small>
              </td>
              <td>{r.family}</td>
              <td>{r.location}</td>
              <td>{r.size}</td>
              <td>{r.color}</td>
              <td>
                <strong>{n(r.available)}</strong>
              </td>
              <td>{n(r.physical)}</td>
              <td>{n(r.physical - r.available)}</td>
              <td>
                <StockBadge qty={r.available} />
              </td>
              <td>{date(r.synced)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export default function StockStudio({
  rows,
  synced,
}: {
  rows: Row[];
  synced: string | null;
}) {
  const [view, setView] = useState("overview"),
    [query, setQuery] = useState(""),
    [location, setLocation] = useState(""),
    [family, setFamily] = useState(""),
    [status, setStatus] = useState(""),
    [dimension, setDimension] = useState<Dimension>("family"),
    [metric, setMetric] = useState<"available" | "physical">("available"),
    [sort, setSort] = useState("stock"),
    [page, setPage] = useState(1);
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!location || r.locationId === location) &&
          (!family || r.family === family) &&
          (!query ||
            [r.product, r.variant, r.sku, r.barcode, r.color, r.size]
              .join(" ")
              .toLocaleLowerCase()
              .includes(query.toLocaleLowerCase())) &&
          (!status ||
            (status === "out"
              ? r.available <= 0
              : status === "low"
                ? r.available > 0 && r.available <= 3
                : r.available > 3)),
      ),
    [rows, location, family, query, status],
  );
  const ordered = useMemo(
    () =>
      [...filtered].sort((a, b) =>
        sort === "name"
          ? a.product.localeCompare(b.product, "fr")
          : sort === "physical"
            ? b.physical - a.physical
            : a.available - b.available,
      ),
    [filtered, sort],
  );
  const groups = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of filtered) {
      const k =
        dimension === "location"
          ? r.locationId
          : dimension === "product"
            ? r.productId
            : r[dimension];
      m.set(k, [...(m.get(k) || []), r]);
    }
    return [...m]
      .map(([key, items]) => ({
        key,
        label: items[0][dimension],
        items,
        total: sum(items, metric),
      }))
      .sort((a, b) => b.total - a.total);
  }, [filtered, dimension, metric]);
  const low = filtered.filter(
      (r) => r.available > 0 && r.available <= 3,
    ).length,
    out = filtered.filter((r) => r.available <= 0).length,
    healthy = filtered.length - low - out;
  const max = Math.max(1, ...groups.map((g) => Math.abs(g.total)));
  const products = new Set(filtered.map((r) => r.productId)).size,
    variants = new Set(filtered.map((r) => r.variantId)).size;
  function reset() {
    setQuery("");
    setLocation("");
    setFamily("");
    setStatus("");
    setPage(1);
  }
  function exportCsv() {
    const esc = (v: string | number) =>
      '"' +
      String(v)
        .replace(/^[=+@\-\t\r]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    const lines = [
      [
        "Produit",
        "Variante",
        "SKU",
        "Code-barres",
        "Famille",
        "Magasin",
        "Taille",
        "Couleur",
        "Disponible",
        "Physique",
        "Écart physique-disponible",
        "Synchronisation",
      ],
      ...ordered.map((r) => [
        r.product,
        r.variant,
        r.sku,
        r.barcode,
        r.family,
        r.location,
        r.size,
        r.color,
        r.available,
        r.physical,
        r.physical - r.available,
        r.synced,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ["\uFEFF" + lines.map((l) => l.map(esc).join(";")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "stockify-stock.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="studio">
      <header className="studio-heading">
        <div>
          <span className="studio-eyebrow">STOCK INTELLIGENCE</span>
          <h1>Votre stock, sous tous les angles.</h1>
          <p>Explorez, comparez et identifiez vos priorités de réassort.</p>
        </div>
        <button
          className="studio-button"
          onClick={exportCsv}
          disabled={!filtered.length}
        >
          ↓ Exporter les données
        </button>
      </header>
      <div className="studio-freshness">
        <span className="status-dot" />{" "}
        {synced
          ? "Dernière synchronisation : " + date(synced)
          : "Aucune synchronisation Shopify enregistrée"}{" "}
        <a href="/settings">Gérer la synchronisation →</a>
      </div>
      <div className="studio-filters">
        <label>
          Rechercher
          <input
            value={query}
            placeholder="Produit, SKU, code-barres…"
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Magasin
          <select
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tous les magasins</option>
            {[
              ...new Map(rows.map((r) => [r.locationId, r.location])).entries(),
            ].map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Famille
          <select
            value={family}
            onChange={(e) => {
              setFamily(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Toutes les familles</option>
            {[...new Set(rows.map((r) => r.family))].sort().map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label>
          État du stock
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tous les états</option>
            <option value="out">Rupture (≤ 0)</option>
            <option value="low">Faible (1–3)</option>
            <option value="in">En stock (&gt; 3)</option>
          </select>
        </label>
        <button className="studio-reset" onClick={reset}>
          Réinitialiser
        </button>
      </div>
      <div className="studio-kpis">
        {[
          [
            "Stock disponible",
            n(sum(filtered, "available")),
            "Unités disponibles",
          ],
          ["Stock physique", n(sum(filtered, "physical")), "Unités présentes"],
          ["Catalogue", n(products), n(variants) + " variantes distinctes"],
          ["Ruptures", n(out), "Lignes variante × magasin"],
          ["Stock faible", n(low), "Seuil : 1 à 3 unités"],
        ].map(([title, value, hint], i) => (
          <article className={"studio-kpi kpi-" + i} key={title}>
            <span>{title}</span>
            <strong>{value}</strong>
            <small>{hint}</small>
          </article>
        ))}
      </div>
      <div className="studio-viewbar">
        <nav aria-label="Vues statistiques">
          {[
            ["overview", "◫ Vue d’ensemble"],
            ["groups", "☰ Sections dépliables"],
            ["table", "▤ Toutes les données"],
          ].map(([id, title]) => (
            <button
              key={id}
              aria-pressed={view === id}
              onClick={() => setView(id)}
            >
              {title}
            </button>
          ))}
        </nav>
        <span aria-live="polite">{n(filtered.length)} lignes analysées</span>
      </div>
      {!filtered.length ? (
        <div className="studio-empty">
          <h2>Aucune donnée dans cette sélection</h2>
          <p>
            Modifiez les filtres ou synchronisez votre boutique pour alimenter
            ce tableau de bord.
          </p>
          <button className="studio-button" onClick={reset}>
            Effacer les filtres
          </button>
        </div>
      ) : (
        <>
          {view !== "table" && (
            <div className="studio-dimensions">
              <label>
                Regrouper par{" "}
                <select
                  value={dimension}
                  onChange={(e) => setDimension(e.target.value as Dimension)}
                >
                  {[
                    ["family", "Famille"],
                    ["product", "Produit"],
                    ["location", "Magasin"],
                    ["size", "Taille"],
                    ["color", "Couleur"],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Mesure{" "}
                <select
                  value={metric}
                  onChange={(e) =>
                    setMetric(e.target.value as "available" | "physical")
                  }
                >
                  <option value="available">Stock disponible</option>
                  <option value="physical">Stock physique</option>
                </select>
              </label>
            </div>
          )}
          {view === "overview" && (
            <>
              <div className="studio-chart-grid">
                <article className="studio-panel">
                  <header>
                    <div className="studio-eyebrow">RÉPARTITION</div>
                    <h2>Où se trouve votre stock ?</h2>
                    <p>
                      Comparaison par{" "}
                      {
                        {
                          family: "famille",
                          product: "produit",
                          location: "magasin",
                          size: "taille",
                          color: "couleur",
                        }[dimension]
                      }{" "}
                      · {metric === "available" ? "disponible" : "physique"}
                    </p>
                  </header>
                  <div className="studio-bars">
                    {groups.map((g) => (
                      <div className="studio-bar-row" key={g.key}>
                        <span>{g.label}</span>
                        <div className="studio-track">
                          <div
                            style={{
                              width: (Math.abs(g.total) / max) * 100 + "%",
                              background: g.total < 0 ? "#b84e40" : undefined,
                            }}
                          />
                        </div>
                        <strong>{n(g.total)}</strong>
                      </div>
                    ))}
                  </div>
                </article>
                <article className="studio-panel">
                  <header>
                    <div className="studio-eyebrow">SANTÉ DU STOCK</div>
                    <h2>Disponibilité des références</h2>
                    <p>Chaque variante est comptée par magasin.</p>
                  </header>
                  <div
                    className="studio-donut"
                    role="img"
                    aria-label={`${healthy} en stock, ${low} faibles, ${out} ruptures`}
                    style={{
                      background: `conic-gradient(#176b56 0 ${(healthy / filtered.length) * 100}%, #d9a44d ${(healthy / filtered.length) * 100}% ${((healthy + low) / filtered.length) * 100}%, #c76556 ${((healthy + low) / filtered.length) * 100}% 100%)`,
                    }}
                  >
                    <div>
                      <strong>
                        {Math.round(((healthy + low) / filtered.length) * 100)}%
                      </strong>
                      <span>avec du stock</span>
                    </div>
                  </div>
                  <div className="studio-legend">
                    {[
                      ["En stock", healthy, "#176b56"],
                      ["Stock faible", low, "#d9a44d"],
                      ["Rupture", out, "#c76556"],
                    ].map(([l, v, c]) => (
                      <div key={l}>
                        <i style={{ background: String(c) }} />
                        {l}
                        <strong>{n(Number(v))}</strong>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
              <article className="studio-panel studio-priorities">
                <header>
                  <div className="studio-eyebrow">À SURVEILLER</div>
                  <h2>Priorités de réassort</h2>
                  <p>Les 8 niveaux les plus bas de votre sélection.</p>
                </header>
                <Table
                  rows={[...filtered]
                    .filter((r) => r.available <= 3)
                    .sort((a, b) => a.available - b.available)
                    .slice(0, 8)}
                />
                {!low && !out && <p>Aucune alerte pour cette sélection.</p>}
              </article>
            </>
          )}
          {view === "groups" && (
            <div className="studio-groups">
              {groups.map((g) => (
                <details key={g.key} className="studio-group">
                  <summary>
                    <span className="studio-group-icon">☰</span>
                    <span>
                      <strong>{g.label}</strong>
                      <small>
                        {new Set(g.items.map((r) => r.productId)).size} produits
                        · {g.items.length} lignes
                      </small>
                    </span>
                    <span className="studio-group-total">
                      <strong>{n(g.total)}</strong>
                      <small>
                        unités{" "}
                        {metric === "available" ? "disponibles" : "physiques"}
                      </small>
                    </span>
                    <span className="studio-group-alert">
                      {g.items.filter((r) => r.available <= 3).length} alertes
                    </span>
                    <span className="studio-chevron">⌄</span>
                  </summary>
                  <Table rows={g.items} />
                </details>
              ))}
            </div>
          )}
          {view === "table" && (
            <article className="studio-panel">
              <div className="studio-table-toolbar">
                <div>
                  <h2>Explorateur de données</h2>
                  <p>Une ligne par variante et par magasin.</p>
                </div>
                <label>
                  Trier par{" "}
                  <select
                    value={sort}
                    onChange={(e) => {
                      setSort(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="stock">Disponible croissant</option>
                    <option value="physical">Physique décroissant</option>
                    <option value="name">Nom du produit</option>
                  </select>
                </label>
              </div>
              <Table rows={ordered.slice((page - 1) * 50, page * 50)} />
              <div className="studio-pagination">
                <button disabled={page === 1} onClick={() => setPage(page - 1)}>
                  ← Précédent
                </button>
                <span>
                  Page {page} / {Math.max(1, Math.ceil(ordered.length / 50))}
                </span>
                <button
                  disabled={page * 50 >= ordered.length}
                  onClick={() => setPage(page + 1)}
                >
                  Suivant →
                </button>
              </div>
            </article>
          )}
        </>
      )}
      <footer className="studio-notes">
        <p>
          ¹ Écart = stock physique − stock disponible. Cet écart ne représente
          pas uniquement les réservations.
        </p>
        <p>
          Vue instantanée des données synchronisées · magasins actifs et inclus
          uniquement. Ventes, valorisation et évolution historique ne sont pas
          encore disponibles.
        </p>
      </footer>
    </section>
  );
}
