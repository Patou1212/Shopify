export const dynamic = "force-dynamic";
import { requireAdmin } from "@/lib/account";
import { db } from "@/lib/db";
import { InvitationForm } from "../account/forms";
import { updateClient } from "../account/actions";
import "../account/saas.css";
export default async function AdminPage() {
  await requireAdmin();
  const [workspaces, events, unassigned] = await Promise.all([
    db.workspace.findMany({
      include: { _count: { select: { shops: true, members: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.platformEvent.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    db.shop.count({ where: { workspaceId: null } }),
  ]);
  return (
    <main className="saas-shell">
      <header className="saas-header">
        <div>
          <span className="saas-tag">STOCKIFY · ADMINISTRATION</span>
          <h1>Vos espaces clients</h1>
          <p>Offres, quotas de boutiques et accès à la plateforme.</p>
        </div>
        <a href="/account">Mon espace</a>
      </header>
      {unassigned > 0 && (
        <p className="saas-notice">
          {unassigned} boutique(s) historique(s) sans espace. Leur rattachement
          nécessite la commande de migration explicite décrite dans la
          documentation.
        </p>
      )}
      <details className="saas-card">
        <summary>Créer un espace client</summary>
        <InvitationForm />
      </details>
      <p>
        Les 100 espaces les plus récents. Les offres sont gérées manuellement,
        sans prélèvement automatique.
      </p>
      <div className="saas-grid">
        {workspaces.map((w) => (
          <section className="saas-card" key={w.id}>
            <h2>{w.name}</h2>
            <p>
              {w._count.shops} boutique(s) · {w._count.members} membre(s)
            </p>
            <code>{w.id}</code>
            <form action={updateClient} className="saas-form">
              <input type="hidden" name="workspaceId" value={w.id} />
              <label>
                Offre
                <input
                  name="plan"
                  defaultValue={w.plan}
                  maxLength={50}
                  required
                />
              </label>
              <label>
                Quota boutiques
                <input
                  type="number"
                  name="shopLimit"
                  defaultValue={w.shopLimit}
                  min={1}
                  max={1000}
                  required
                />
              </label>
              <label>
                <span>
                  <input
                    type="checkbox"
                    name="suspended"
                    defaultChecked={w.suspended}
                  />{" "}
                  Suspendre cet espace
                </span>
              </label>
              <button>Enregistrer</button>
            </form>
          </section>
        ))}
      </div>
      <section className="saas-card">
        <h2>Dernières actions d’administration</h2>
        {events.map((e) => (
          <div key={e.id} className="saas-row">
            <span>
              {e.action} · {e.details}
              <br />
              <small>
                Acteur : {e.actorId} · Espace : {e.target}
              </small>
            </span>
            <time>{e.createdAt.toLocaleString("fr-FR")}</time>
          </div>
        ))}
      </section>
    </main>
  );
}
