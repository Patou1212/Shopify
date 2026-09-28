import { requireAccount } from "@/lib/account";
import { db } from "@/lib/db";
import { connectionError, roles } from "@/lib/onboarding";
import { logout, selectShop } from "./actions";
import { InvitationForm } from "./forms";
import { ConnectForm, ImportForm, Steps } from "./onboarding-forms";
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    connected?: string;
    welcome?: string;
  }>;
}) {
  const { account } = await requireAccount();
  const params = await searchParams;
  const error = connectionError(params.error);
  const memberships = await db.membership.findMany({
    where: { accountId: account.id },
    include: {
      workspace: {
        include: {
          shops: {
            select: {
              id: true,
              name: true,
              domain: true,
              status: true,
              lastSyncedAt: true,
            },
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
          <a href="/account" className="saas-brand">
            stockify
          </a>
          <h1>Mes boutiques</h1>
          <p>
            Bonjour {account.name}. Retrouvez votre inventaire et votre équipe.
          </p>
        </div>
        <nav>
          {account.platformAdmin && (
            <a href="/admin">Administration · Mes clients</a>
          )}
          <form action={logout}>
            <button className="saas-secondary">Se déconnecter</button>
          </form>
        </nav>
      </header>
      {error && (
        <section role="alert" className="saas-notice">
          <strong>La boutique n’a pas été connectée</strong>
          <p>{error}</p>
        </section>
      )}
      {params.welcome && (
        <p role="status" className="saas-success">
          Votre compte est prêt. Connectez maintenant votre première boutique.
        </p>
      )}
      {memberships.length === 0 && (
        <section className="saas-card">
          <h2>Votre accès reste à activer</h2>
          <p>Ouvrez le lien d’invitation reçu pour rejoindre votre équipe.</p>
        </section>
      )}
      {memberships.map(({ role, workspace: w }) => {
        const ready = w.shops.some((s) => s.lastSyncedAt);
        const step = w.shops.length === 0 ? 2 : ready ? 4 : 3;
        return (
          <section key={w.id} className="workspace-section">
            {memberships.length > 1 && <h2>{w.name}</h2>}
            {w.suspended ? (
              <section className="saas-notice">
                <h2>Votre espace est suspendu</h2>
                <p>
                  Contactez l’administrateur Stockify pour rétablir votre accès.
                </p>
              </section>
            ) : (
              <>
                {step < 4 && <Steps step={step} />}
                <div className="saas-section-heading">
                  <h2>
                    {w.shops.length === 0
                      ? "Connectez votre première boutique"
                      : "Vos boutiques connectées"}
                  </h2>
                  <span className="saas-tag">
                    {w.shops.length} / {w.shopLimit} boutique
                    {w.shopLimit > 1 ? "s" : ""}
                  </span>
                </div>
                {w.shops.length === 0 && (
                  <section className="saas-card onboarding-card">
                    <div>
                      <span className="saas-tag">ÉTAPE 2 SUR 3</span>
                      <h3>Votre boutique, vos données.</h3>
                      <p>
                        Autorisez Stockify à lire vos produits et vos stocks.
                        Vous pourrez ensuite gérer votre inventaire depuis un
                        seul endroit.
                      </p>
                    </div>
                    {role === "OWNER" ? (
                      <ConnectForm workspaceId={w.id} />
                    ) : (
                      <p>
                        Le propriétaire de cet espace doit connecter la première
                        boutique.
                      </p>
                    )}
                  </section>
                )}
                <div className="saas-grid">
                  {w.shops.map((shop) => (
                    <article key={shop.id} className="saas-card shop-card">
                      <span className="saas-tag">
                        Shopify ·{" "}
                        {shop.status === "ACTIVE"
                          ? shop.lastSyncedAt
                            ? "Prête"
                            : "Import à effectuer"
                          : "À reconnecter"}
                      </span>
                      <h3>{shop.name || shop.domain}</h3>
                      <p className="saas-domain">{shop.domain}</p>
                      {params.connected === shop.id && (
                        <p role="status" className="saas-success">
                          Autorisation Shopify reçue.
                        </p>
                      )}
                      {shop.status === "ACTIVE" &&
                        (shop.lastSyncedAt ? (
                          <>
                            <p className="saas-muted">
                              Dernier import :{" "}
                              {shop.lastSyncedAt.toLocaleString("fr-FR", {
                                timeZone: "Europe/Paris",
                              })}
                            </p>
                            <form action={selectShop}>
                              <input
                                type="hidden"
                                name="shopId"
                                value={shop.id}
                              />
                              <button>Ouvrir mon inventaire →</button>
                            </form>
                          </>
                        ) : (
                          <>
                            <p>
                              Dernière étape : importez les produits, variantes
                              et stocks pour remplir votre inventaire.
                            </p>
                            {role !== "VIEWER" ? (
                              <ImportForm shopId={shop.id} />
                            ) : (
                              <p>
                                Un propriétaire ou gestionnaire doit lancer le
                                premier import.
                              </p>
                            )}
                          </>
                        ))}
                      {role === "OWNER" && (
                        <details className="shop-options">
                          <summary>
                            {shop.status === "ACTIVE"
                              ? "Options de connexion"
                              : "Reconnecter cette boutique"}
                          </summary>
                          <p>
                            Relancez l’autorisation si l’accès Shopify a changé.
                          </p>
                          <a
                            href={`/api/shopify/connect?workspace=${w.id}&shop=${encodeURIComponent(shop.domain)}`}
                          >
                            Autoriser à nouveau Shopify →
                          </a>
                        </details>
                      )}
                    </article>
                  ))}
                </div>
                {w.shops.length > 0 &&
                  role === "OWNER" &&
                  (w.shops.length < w.shopLimit ? (
                    <details className="saas-card">
                      <summary>+ Connecter une autre boutique</summary>
                      <ConnectForm workspaceId={w.id} />
                    </details>
                  ) : (
                    <p className="saas-muted">
                      Toutes vos places sont utilisées ({w.shopLimit}). Votre
                      administrateur peut ajuster cette limite pendant la phase
                      de test.
                    </p>
                  ))}
                <details className="saas-card team-section">
                  <summary>
                    Mon équipe · {w.members.length} personne
                    {w.members.length > 1 ? "s" : ""}
                  </summary>
                  <p>
                    Votre rôle : {roles[role]}. Les gestionnaires peuvent
                    modifier le stock ; les lecteurs peuvent le consulter.
                  </p>
                  {w.members.map((m) => (
                    <div key={m.id} className="saas-row">
                      <span>
                        {m.account.name}
                        <br />
                        <small>{m.account.email}</small>
                      </span>
                      <span className="saas-tag">
                        {roles[m.role] || m.role}
                      </span>
                    </div>
                  ))}
                  {role === "OWNER" && (
                    <details>
                      <summary>Inviter un collaborateur</summary>
                      <InvitationForm workspaceId={w.id} />
                    </details>
                  )}
                </details>
              </>
            )}
          </section>
        );
      })}
    </main>
  );
}
