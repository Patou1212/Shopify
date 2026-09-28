import { ActivationForm } from "../forms";
export default async function ActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <main className="saas-shell saas-login">
      <a href="/">STOCKIFY</a>
      <h1>Activez votre espace.</h1>
      <section className="saas-card">
        <ActivationForm token={token || ""} />
      </section>
    </main>
  );
}
