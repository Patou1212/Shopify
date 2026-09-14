import { RetryAdjustment } from "@/app/inventory/controls";
import { requireShop } from "@/lib/session";
import { db } from "@/lib/db";
export default async function History({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const shop = await requireShop();
  const p = await searchParams;
  const page = Math.max(1, Math.min(100000, Math.floor(Number(p.page) || 1)));
  const rows = await db.inventoryAdjustment.findMany({
    where: { shopId: shop.id },
    include: { variant: { include: { product: true } }, location: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * 50,
    take: 51,
  });
  return (
    <main className="content">
      <a href="/inventory">← Inventaire</a>
      <h1>Historique des ajustements Stockify</h1>
      <p>
        Les mouvements effectués hors de Stockify ne figurent pas dans cet
        historique.
      </p>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Produit / variante</th>
              <th>Emplacement</th>
              <th>Avant → Après</th>
              <th>Variation</th>
              <th>Motif</th>
              <th>État</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 50).map((r) => (
              <tr key={r.id}>
                <td>{r.createdAt.toLocaleString("fr-FR")}</td>
                <td>
                  {r.variant.product.title} · {r.variant.title}
                </td>
                <td>{r.location.name}</td>
                <td>
                  {r.status === "APPLIED"
                    ? `${r.beforeQuantity} → ${r.afterQuantity}`
                    : "Non confirmé"}
                </td>
                <td>
                  {r.delta > 0 ? "+" : ""}
                  {r.delta}
                </td>
                <td>{r.customReason}</td>
                <td>
                  {r.status === "APPLIED"
                    ? "Appliqué"
                    : r.status === "FAILED"
                      ? `Refusé : ${r.error}`
                      : "À vérifier / réessayer avec la même demande"}
                  {r.status === "PENDING" && <RetryAdjustment id={r.id} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p>Aucun ajustement.</p>}
      {page > 1 && <a href={`/history?page=${page - 1}`}>Précédent</a>}{" "}
      {rows.length > 50 && <a href={`/history?page=${page + 1}`}>Suivant</a>}
    </main>
  );
}
