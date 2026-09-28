import { requireAccount } from "@/lib/account";
import { db } from "@/lib/db";
import { logout, selectShop } from "./actions";
import { InvitationForm } from "./forms";
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { account } = await requireAccount();
  const { error } = await searchParams;
  const memberships = await db.membership.findMany({
    where: { accountId: account.id },
    include: {
      workspace: {
        include: {
          shops: {
            select: { id: true, name: true, domain: true, status: true },
          },
          members: {
            include: { account: { select: { name: true, email: true } } },
          },
        },
      },
    },
  });
  return (
    <main className="saas-shell">
      <header className="saas-header">
        <div>
          <span className="saas-tag">STOCKIFY · ESPACE CLIENT</span>
          <h1>Bonjour {account.name}</h1>
          <p>Pilotez vos boutiques et les accès de votre équipe.</p>
        </div>
        <nav>
          {account.platformAdmin && (
            <a href="/admin">Administration générale</a>
          )}
          <form action={logout}>
            <button>Se déconnecter</button>
          </form>
        </nav>
      </header>
      {error && (
        <p role="alert" className="saas-notice">
          Connexion non finalisée. Vérifiez les droits de l’espace, son quota et
          le rattachement de la boutique.
        </p>
      )}
      {memberships.length === 0 && (
        <section className="saas-card">
          Aucun espace associé. Utilisez votre lien d’invitation ou contactez
          l’administrateur.
        </section>
      )}
      {memberships.map(({ role, workspace: w }) => (
        <section key={w.id} className="saas-card">
          <span className="saas-tag">
            {w.plan} · {w.shops.length} / {w.shopLimit} boutiques
          </span>
          <h2>{w.name}</h2>
          <p>
            Votre rôle :{" "}
            {
              (
                {
                  OWNER: "Propriétaire",
                  MANAGER: "Gestionnaire",
                  VIEWER: "Lecture seule",
                } as Record<string, string>
              )[role]
            }
          </p>
          {w.suspended ? (
            <p className="saas-notice">
              Cet espace est suspendu. Contactez Stockify.
            </p>
          ) : (
            <>
              <div className="saas-grid">
                {w.shops.map((shop) => (
                  <article key={shop.id} className="saas-card">
                    <h3>{shop.name || shop.domain}</h3>
                    <p>{shop.domain}</p>
                    <p className="saas-muted">Shopify · {shop.status}</p>
                    {shop.status === "ACTIVE" && (
                      <form action={selectShop}>
                        <input type="hidden" name="shopId" value={shop.id} />
                        <button>Ouvrir la boutique</button>
                      </form>
                    )}
                    {role === "OWNER" && (
                      <a
                        href={`/api/shopify/connect?workspace=${w.id}&shop=${encodeURIComponent(shop.domain)}`}
                      >
                        Reconnecter
                      </a>
                    )}
                  </article>
                ))}
              </div>
              {role === "OWNER" &&
                (w.shops.length < w.shopLimit ? (
                  <form action="/api/shopify/connect" className="saas-form">
                    <input type="hidden" name="workspace" value={w.id} />
                    <label>
                      Ajouter une boutique Shopify
                      <input
                        name="shop"
                        placeholder="ma-boutique.myshopify.com"
                        required
                      />
                    </label>
                    <button>Lier la boutique</button>
                  </form>
                ) : (
                  <p className="saas-notice">
                    Quota atteint. Contactez Stockify pour faire évoluer votre
                    offre.
                  </p>
                ))}
              <h3>Votre équipe</h3>
              {w.members.map((m) => (
                <div key={m.id} className="saas-row">
                  <span>
                    {m.account.name} · {m.account.email}
                  </span>
                  <span className="saas-muted">{m.role}</span>
                </div>
              ))}
              {role === "OWNER" && (
                <details>
                  <summary>Inviter un collaborateur</summary>
                  <InvitationForm workspaceId={w.id} />
                </details>
              )}
            </>
          )}
        </section>
      ))}
    </main>
  );
}
