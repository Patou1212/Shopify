import { Portal } from "@/app/components/portal";
import { requireShop } from "@/lib/session";
import { db } from "@/lib/db";
export default async function Audit({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; page?: string }>;
}) {
  const shop = await requireShop();
  const p = await searchParams;
  const tab =
    p.tab === "connections"
      ? "connections"
      : p.tab === "stock"
        ? "stock"
        : "products";
  const page = Math.max(1, Math.min(100000, Math.floor(Number(p.page) || 1)));
  const q = (p.q || "").slice(0, 200);
  const where = {
    shopId: shop.id,
    category: tab,
    ...(q
      ? {
          OR: [
            { subject: { contains: q, mode: "insensitive" as const } },
            { actor: { contains: q, mode: "insensitive" as const } },
            { details: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [rows, count] = await Promise.all([
    db.auditEvent.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * 50,
      take: 50,
    }),
    db.auditEvent.count({ where }),
  ]);
  const title =
    tab === "connections"
      ? "Historique des connexions"
      : tab === "stock"
        ? "Écarts de stock détectés"
        : "Activité des produits";
  const link = (page: number) =>
    `/audit?${new URLSearchParams({ tab, q, page: String(page) })}`;
  return (
    <Portal
      active={tab === "connections" ? "connections" : "audit"}
      shop={shop}
    >
      <div className="studio">
        <header className="studio-heading">
          <div>
            <span className="studio-eyebrow">TRAÇABILITÉ</span>
            <h1>{title}</h1>
            <p>
              Retrouvez les événements enregistrés et les changements observés
              dans votre boutique.
            </p>
          </div>
        </header>
        <nav className="audit-tabs" aria-label="Journaux de suivi">
          <a
            aria-current={tab === "connections" ? "page" : undefined}
            href="/audit?tab=connections"
          >
            Connexions
          </a>
          <a
            aria-current={tab === "products" ? "page" : undefined}
            href="/audit?tab=products"
          >
            Produits et variantes
          </a>
          <a
            aria-current={tab === "stock" ? "page" : undefined}
            href="/audit?tab=stock"
          >
            Écarts synchronisés
          </a>
          <a href="/history">Ajustements Stockify →</a>
        </nav>
        <aside className="audit-notice">
          <strong>
            {tab === "connections"
              ? "Identification individuelle à configurer"
              : "Ce que ce journal permet de vérifier"}
          </strong>
          <p>
            {tab === "connections"
              ? "Les nouvelles connexions réussies à Stockify sont enregistrées à partir de maintenant. Une session de boutique ne permet pas encore de savoir quel salarié se connecte. Les connexions anciennes et celles réalisées directement dans Shopify ne sont pas disponibles."
              : "Les changements sont détectés lors des synchronisations réussies, à la date du constat. Leur auteur et leur heure exacte ne sont pas fournis par cette comparaison. Le premier import constitue un état initial, pas une création de produit. Les changements intermédiaires peuvent ne pas être visibles."}
          </p>
        </aside>
        <form className="studio-filters" action="/audit">
          <input type="hidden" name="tab" value={tab} />
          <label>
            Rechercher
            <input
              name="q"
              defaultValue={q}
              placeholder="Produit, session ou détail…"
            />
          </label>
          <button className="studio-button">Filtrer</button>
          <a href={`/audit?tab=${tab}`}>Réinitialiser</a>
        </form>
        <section className="studio-panel" style={{ marginTop: 20 }}>
          <h2>
            {count} événement{count !== 1 ? "s" : ""}
          </h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date du constat</th>
                  <th>Événement</th>
                  <th>Produit / session</th>
                  <th>Auteur / origine</th>
                  <th>Détail</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.createdAt.toLocaleString("fr-FR", {
                        timeZone: "Europe/Paris",
                      })}
                    </td>
                    <td>{r.action}</td>
                    <td>{r.subject}</td>
                    <td>
                      {r.actor}
                      <small className="audit-source">{r.source}</small>
                    </td>
                    <td>
                      <details>
                        <summary>Voir le détail</summary>
                        <p className="audit-detail">{r.details}</p>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && (
            <div className="studio-empty">
              <h2>Aucun événement enregistré</h2>
              <p>
                {q
                  ? "Aucun résultat pour cette recherche."
                  : tab === "connections"
                    ? "Les prochaines ouvertures de session apparaîtront ici."
                    : "Les prochains changements détectés pendant une synchronisation apparaîtront ici."}
              </p>
            </div>
          )}
          <div className="studio-pagination">
            {page > 1 && <a href={link(page - 1)}>← Précédent</a>}
            <span>Page {page}</span>
            {page * 50 < count && <a href={link(page + 1)}>Suivant →</a>}
          </div>
        </section>
        <footer className="studio-notes">
          <p>
            Un écart peut venir d’une vente, d’un retour, d’une correction ou
            d’un mouvement de stock. Il ne prouve pas un vol.
          </p>
        </footer>
      </div>
    </Portal>
  );
}
