"use client";
import { useActionState } from "react";
import { login, activate, inviteMember, createClient } from "./actions";
export function LoginForm() {
  const [state, action, pending] = useActionState(login, {});
  return (
    <form action={action} className="saas-form">
      <label>
        E-mail
        <input type="email" name="email" autoComplete="username" required />
      </label>
      <label>
        Mot de passe
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          maxLength={256}
        />
      </label>
      {state.error && (
        <p role="alert" className="error">
          {state.error}
        </p>
      )}
      <button disabled={pending}>
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
export function ActivationForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(activate, {});
  return (
    <form action={action} className="saas-form">
      <input type="hidden" name="token" value={token} />
      <label>
        Choisissez votre mot de passe
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={256}
        />
      </label>
      <p>
        12 caractères minimum. Si votre compte existe déjà,{" "}
        <a href="/account/login">connectez-vous</a> puis revenez sur cette
        invitation ; laissez ce champ vide.
      </p>
      {state.error && (
        <p role="alert" className="error">
          {state.error}
        </p>
      )}
      <button disabled={pending}>Activer mon accès</button>
    </form>
  );
}
export function InvitationForm({ workspaceId }: { workspaceId?: string }) {
  const [state, action, pending] = useActionState(
    workspaceId ? inviteMember : createClient,
    {},
  );
  return (
    <form action={action} className="saas-form">
      {workspaceId && (
        <input type="hidden" name="workspaceId" value={workspaceId} />
      )}
      <label>
        {workspaceId ? "Nom" : "Nom de l’espace client"}
        <input name="name" required maxLength={100} />
      </label>
      <label>
        E-mail {workspaceId ? "du collaborateur" : "du propriétaire"}
        <input type="email" name="email" required maxLength={254} />
      </label>
      {workspaceId ? (
        <label>
          Rôle
          <select name="role">
            <option value="VIEWER">Lecture seule</option>
            <option value="MANAGER">Gestionnaire du stock</option>
          </select>
        </label>
      ) : (
        <>
          <label>
            Offre
            <input name="plan" defaultValue="Solo" maxLength={50} />
          </label>
          <label>
            Nombre de boutiques
            <input
              type="number"
              name="shopLimit"
              defaultValue={1}
              min={1}
              max={1000}
              required
            />
          </label>
        </>
      )}
      {state.error && (
        <p role="alert" className="error">
          {state.error}
        </p>
      )}
      {state.link && (
        <p role="status">
          Invitation créée, valable 24 h. Copiez ce lien et transmettez-le au
          destinataire :{" "}
          <a href={state.link}>
            {typeof window !== "undefined" ? window.location.origin : ""}
            {state.link}
          </a>
        </p>
      )}
      <button disabled={pending}>
        {pending ? "Création…" : "Créer l’invitation"}
      </button>
    </form>
  );
}
