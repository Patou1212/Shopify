"use client";
import { useActionState, useState } from "react";
import { register, importShop, selectShop } from "./actions";
import { isValidShopDomain, normalizeShopDomain } from "@/lib/shopify/domain";
export function RegisterForm() {
  const [state, action, pending] = useActionState(register, {});
  return (
    <form action={action} className="saas-form">
      <label>
        Votre nom
        <input name="name" autoComplete="name" maxLength={100} required />
      </label>
      <label>
        Votre adresse e-mail
        <input
          name="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          required
        />
      </label>
      <label>
        Votre mot de passe
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={256}
          required
          aria-describedby="password-help"
        />
      </label>
      <small id="password-help">
        12 caractères minimum. Utilisez un mot de passe unique.
      </small>
      <label>
        Confirmer le mot de passe
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={256}
          required
        />
      </label>
      <div hidden aria-hidden="true">
        <label>
          Site web
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {state.error && (
        <p role="alert" className="error">
          {state.error}
        </p>
      )}
      <button disabled={pending}>
        {pending ? "Création de votre espace…" : "Créer mon compte gratuit"}
      </button>
      <p className="saas-muted">
        Aucune carte bancaire. Vous connecterez votre boutique à l’étape
        suivante.
      </p>
    </form>
  );
}
export function ConnectForm({ workspaceId }: { workspaceId: string }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <form
      action="/api/shopify/connect"
      method="get"
      className="saas-form"
      onSubmit={(e) => {
        if (!isValidShopDomain(normalizeShopDomain(value))) {
          e.preventDefault();
          setError(
            "Utilisez le domaine qui se termine par .myshopify.com, pas le nom commercial de votre boutique.",
          );
          return;
        }
        setError("");
        setPending(true);
      }}
    >
      <input type="hidden" name="workspace" value={workspaceId} />
      <label>
        Domaine de votre boutique Shopify
        <input
          name="shop"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError("");
            setPending(false);
          }}
          placeholder="exemple.myshopify.com"
          required
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby={`help-${workspaceId}`}
          aria-invalid={!!error}
        />
      </label>
      <small id={`help-${workspaceId}`}>
        Dans votre administration Shopify : Paramètres → Domaines. Copiez
        l’adresse se terminant par <strong>.myshopify.com</strong>.
      </small>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <a href="/account/help/shopify" target="_blank" rel="noreferrer">
        Besoin d’aide ? Voir le guide de connexion ↗
      </a>
      <button disabled={pending}>
        {pending ? "Ouverture de Shopify…" : "Connecter Shopify →"}
      </button>
      <p className="saas-muted">
        Shopify vous demandera d’autoriser Stockify. Vous reviendrez ensuite ici
        pour importer vos produits. Aucune clé API à saisir.
      </p>
    </form>
  );
}
export function ImportForm({ shopId }: { shopId: string }) {
  const [state, action, pending] = useActionState(importShop, {});
  return (
    <div>
      <form action={action} className="saas-form" aria-busy={pending}>
        <input name="shopId" type="hidden" value={shopId} />
        {!state.message && (
          <button disabled={pending}>
            {pending
              ? "Import en cours…"
              : state.error
                ? "Réessayer l’import"
                : "Importer mes produits"}
          </button>
        )}
        {pending && (
          <p role="status" className="import-status">
            <span className="saas-spinner" />
            Lecture des produits, variantes et stocks depuis Shopify. Cela peut
            prendre quelques minutes. Gardez cette page ouverte.
          </p>
        )}
        {state.error && (
          <p role="alert" className="error">
            {state.error}
          </p>
        )}
        {state.message && (
          <p role="status" className="saas-success">
            {state.message}
          </p>
        )}
      </form>
      {state.message && (
        <form action={selectShop}>
          <input type="hidden" name="shopId" value={shopId} />
          <button>Ouvrir mon inventaire →</button>
        </form>
      )}
    </div>
  );
}
export function Steps({ step }: { step: number }) {
  return (
    <ol className="onboarding-steps" aria-label="Votre progression">
      {["Créer mon compte", "Connecter Shopify", "Importer mes produits"].map(
        (label, i) => (
          <li
            key={label}
            aria-current={i + 1 === step ? "step" : undefined}
            className={i + 1 < step ? "done" : i + 1 === step ? "current" : ""}
          >
            <span>{i + 1 < step ? "✓" : i + 1}</span>
            {label}
          </li>
        ),
      )}
    </ol>
  );
}
