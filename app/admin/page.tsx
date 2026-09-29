import { WorkspaceHeader } from "../account/workspace-header";
export const dynamic = "force-dynamic";
import { requireAdmin } from "@/lib/account";
import { db } from "@/lib/db";
import { InvitationForm } from "../account/forms";
import { updateClient } from "../account/actions";
import "../account/saas.css";
export default async function AdminPage() {
  const { account } = await requireAdmin();
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
      <WorkspaceHeader name={account.name} admin={account.platformAdmin} section="clients" />
      <section className="saas-card onboarding-card">
        <div>
          <span className="saas-tag">Connexion Shopify</span>
          <h2>Le même parcours pour chaque boutique</h2>
          <p>Dans « Mes boutiques », saisissez le domaine Shopify, autorisez Stockify, puis importez vos produits.</p>
          <p>Pour une boutique cliente, son propriétaire effectue ces étapes dans son propre espace. La boutique sera liée à cet espace.</p>
        </div>
        <a href="/account">Accéder à mes boutiques →</a>
      </section>
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
        Les 100 clients les plus récents. Accès gratuit pendant la phase de
        test.
      </p>
      <div className="saas-grid">
        {workspaces.map((w) => (
          <section className="saas-card" key={w.id}>
            <span className="saas-tag">{w.suspended ? "Espace suspendu" : "Espace actif"} · {w._count.shops} / {w.shopLimit} boutiques</span>
            <h2>{w.name}</h2>
            <p>
              {w._count.shops} boutique(s) · {w._count.members} membre(s)
            </p>
            <details>
              <summary>Informations techniques</summary>
              <code>{w.id}</code>
            </details>
            <details className="shop-options">
              <summary>Gérer les accès de cet espace</summary>
            <form action={updateClient} className="saas-form">
              <input type="hidden" name="workspaceId" value={w.id} />
              <input type="hidden" name="plan" value={w.plan} />
              <label>
                Nombre de boutiques autorisées
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
            </details>
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
