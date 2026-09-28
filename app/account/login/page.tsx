import { LoginForm } from "../forms";
export default function LoginPage() {
  return (
    <main className="saas-shell saas-login">
      <a href="/">STOCKIFY</a>
      <h1>Bienvenue dans votre espace.</h1>
      <p>Vos boutiques, votre équipe et vos stocks réunis.</p>
      <section className="saas-card">
        <LoginForm />
      </section>
      <p>
        Pas encore de compte ou mot de passe oublié ? Contactez l’administrateur
        Stockify. L’accès à cette première version se fait sur invitation.
      </p>
    </main>
  );
}
