import { redirect } from "next/navigation";
import { accountSession, saasEnabled } from "@/lib/account";
import { RegisterForm, Steps } from "../onboarding-forms";
export default async function RegisterPage() {
  if (await accountSession()) redirect("/account");
  const enabled =
    saasEnabled() && process.env.STOCKIFY_PUBLIC_SIGNUP !== "false";
  return (
    <main className="saas-shell saas-login">
      <a href="/" className="saas-brand">
        stockify<span>Votre stock, en toute clarté.</span>
      </a>
      <Steps step={1} />
      <h1>Votre inventaire commence ici.</h1>
      <p>
        Créez votre compte, puis connectez votre boutique Shopify. Votre espace
        est préparé automatiquement.
      </p>
      <section className="saas-card">
        {enabled ? (
          <RegisterForm />
        ) : (
          <p>Les inscriptions sont momentanément fermées.</p>
        )}
      </section>
      <p>
        Déjà un compte ? <a href="/account/login">Me connecter</a>
      </p>
    </main>
  );
}
