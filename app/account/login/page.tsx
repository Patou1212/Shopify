import { LoginForm } from "../forms";
import { accountSession, saasEnabled } from "@/lib/account";
import { redirect } from "next/navigation";
export default async function LoginPage() {
  if (await accountSession()) redirect("/account");
  return (
    <main className="saas-shell saas-login">
      <a href="/" className="saas-brand">
        stockify<span>Votre stock, en toute clarté.</span>
      </a>
      <h1>Heureux de vous retrouver.</h1>
      <p>Connectez-vous pour retrouver vos boutiques et votre inventaire.</p>
      <section className="saas-card">
        <LoginForm />
      </section>
      {saasEnabled() && process.env.STOCKIFY_PUBLIC_SIGNUP !== "false" && (
        <p>
          Vous découvrez Stockify ?{" "}
          <a href="/account/register">Créer mon compte gratuit</a>
        </p>
      )}
      <details>
        <summary>Besoin d’aide pour vous connecter ?</summary>
        <p>
          Si vous avez reçu une invitation, ouvrez son lien pour activer votre
          accès. En cas d’oubli du mot de passe, contactez l’administrateur
          Stockify pour recevoir un nouveau lien.
        </p>
      </details>
    </main>
  );
}
