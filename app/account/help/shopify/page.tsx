export default function ShopifyHelp() {
  return (
    <main className="saas-shell">
      <header className="saas-header">
        <div>
          <a href="/account" className="saas-brand">
            stockify
          </a>
          <h1>Connecter votre boutique Shopify</h1>
          <p>
            Votre compte Stockify et votre compte Shopify peuvent avoir des
            adresses e-mail différentes.
          </p>
        </div>
        <a href="/account">← Mes boutiques</a>
      </header>
      <section className="saas-card">
        <h2>Avant de commencer</h2>
        <p>
          Vous devez être propriétaire de l’espace Stockify et disposer d’un
          compte Shopify autorisé à installer des applications sur la boutique
          concernée. Si vous gérez plusieurs boutiques, vérifiez celle que vous
          sélectionnez dans Shopify.
        </p>
        <p>
          Vous n’avez pas besoin de créer une application, de générer une clé
          API ou de communiquer votre mot de passe Shopify à Stockify.
        </p>
      </section>
      <section className="saas-card">
        <h2>Les quatre étapes</h2>
        <ol className="shopify-help-steps">
          <li>
            <h3>Retrouvez votre domaine Shopify</h3>
            <p>
              Dans l’administration de votre boutique, ouvrez{" "}
              <strong>Paramètres → Domaines</strong>. Copiez le domaine se
              terminant par <strong>.myshopify.com</strong>, par exemple{" "}
              <code>ma-boutique.myshopify.com</code>. Votre adresse commerciale
              en .com ou .fr ne remplace pas ce domaine.
            </p>
          </li>
          <li>
            <h3>Demandez la connexion depuis Stockify</h3>
            <p>
              Dans « Mes boutiques », collez ce domaine puis cliquez sur «
              Connecter Shopify ». Si le nombre de boutiques autorisées est
              atteint, ouvrez une boutique existante ou contactez votre
              administrateur.
            </p>
          </li>
          <li>
            <h3>Autorisez Stockify dans Shopify</h3>
            <p>
              Connectez-vous sur Shopify avec vos identifiants habituels.
              Vérifiez le nom de la boutique et les accès demandés : lecture des
              produits, des emplacements et des stocks, ainsi que modification
              des stocks. Acceptez uniquement si vous souhaitez donner ces accès
              à Stockify.
            </p>
          </li>
          <li>
            <h3>Importez votre inventaire</h3>
            <p>
              Shopify vous ramène vers Stockify. Cliquez sur « Importer mes
              produits », attendez la confirmation puis ouvrez votre inventaire.
              Cette étape lit les données ; les ajustements de stock sont des
              actions séparées.
            </p>
          </li>
        </ol>
      </section>
      <section className="saas-card">
        <h2>Si la connexion ne fonctionne pas</h2>
        <details>
          <summary>
            La boutique est déjà associée ou provient d’un ancien compte
          </summary>
          <p>
            Stockify protège les données déjà enregistrées. Utilisez le compte
            qui gère cette boutique. Pour une ancienne boutique non attribuée,
            l’administrateur doit vérifier son propriétaire et effectuer le
            rattachement. Créer une nouvelle clé API ne résoudra pas ce blocage.
          </p>
        </details>
        <details>
          <summary>
            Shopify refuse l’installation ou indique que l’application est
            indisponible
          </summary>
          <p>
            Vérifiez vos droits d’installation sur cette boutique. Si vous êtes
            propriétaire, contactez Stockify : le mode de distribution ou la
            configuration de l’application peut empêcher l’installation. Vous
            n’avez aucun secret technique à modifier.
          </p>
        </details>
        <details>
          <summary>Shopify indique une erreur d’URL de retour</summary>
          <p>
            Transmettez le texte de l’erreur à l’administrateur Stockify.
            L’adresse autorisée doit correspondre au serveur utilisé, notamment
            sur un environnement de test.
          </p>
        </details>
        <details>
          <summary>
            La demande a expiré ou j’ai ouvert la mauvaise boutique
          </summary>
          <p>
            Revenez à « Mes boutiques » et recommencez la connexion. Dans
            Shopify, sélectionnez la boutique correspondant au domaine saisi.
          </p>
        </details>
      </section>
      <p>
        <a href="/account">Revenir à Mes boutiques →</a>
      </p>
      <p className="saas-muted">
        Pour en savoir plus :{" "}
        <a
          href="https://help.shopify.com/en/manual/apps/install-setup-apps"
          target="_blank"
          rel="noreferrer"
        >
          installer une application dans Shopify
        </a>
        .
      </p>
    </main>
  );
}
