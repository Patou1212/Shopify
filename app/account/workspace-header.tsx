import { logout } from "./actions";

export function WorkspaceHeader({ name, admin, section = "shops" }: {
  name: string;
  admin: boolean;
  section?: "shops" | "clients";
}) {
  return (
    <header className="saas-header">
      <div>
        <a href="/account" className="saas-brand">stockify</a>
        <h1>{section === "clients" ? "Mes clients" : "Mes boutiques"}</h1>
        <p>Bonjour {name}. {section === "clients"
          ? "Retrouvez les espaces clients et gérez leurs accès."
          : "Retrouvez votre inventaire et votre équipe."}</p>
      </div>
      <nav aria-label="Navigation de votre espace">
        <a href="/account" aria-current={section === "shops" ? "page" : undefined}>Mes boutiques</a>
        {admin && <a href="/admin" aria-current={section === "clients" ? "page" : undefined}>Mes clients</a>}
        <form action={logout}><button className="saas-secondary">Se déconnecter</button></form>
      </nav>
    </header>
  );
}
