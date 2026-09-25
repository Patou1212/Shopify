"use client";
import { useState, useTransition, useRef } from "react";
import { syncAction, adjustAction, retryAction } from "./actions";
export function SyncButton() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  return (
    <div className="sync-control">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await syncAction();
            setMessage(r.error || ("message" in r ? r.message : "") || "");
          })
        }
      >
        {pending ? "Synchronisation en cours…" : "Synchroniser Shopify"}
      </button>
      {message && (
        <p className="action-message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
export function Adjustment({
  variantId,
  locationId,
  label = "Variante",
  current = 0,
}: {
  variantId: string;
  locationId: string;
  label?: string;
  current?: number;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState("Comptage");
  const [request, setRequest] = useState<{
    delta: number;
    reason: string;
    key: string;
  } | null>(null);
  return (
    <>
      <button
        className="adjust-trigger"
        type="button"
        aria-label={`Ajuster ${label}`}
        onClick={() => dialog.current?.showModal()}
      >
        Ajuster <span aria-hidden="true">↗</span>
      </button>
      <dialog
        ref={dialog}
        className="adjust-dialog"
        aria-label="Ajuster le stock"
      >
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">MOUVEMENT DE STOCK</span>
            <h2>Ajuster le stock</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Fermer"
            disabled={pending}
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </div>
        <p className="dialog-product">{label}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const data = request ?? {
              delta,
              reason:
                reason === "Autre" ? String(form.get("customReason")) : reason,
              key: crypto.randomUUID(),
            };
            if (!data.delta) {
              setMessage("Saisissez une variation différente de zéro.");
              return;
            }
            setRequest(data);
            start(async () => {
              try {
                const r = await adjustAction(
                  variantId,
                  locationId,
                  data.delta,
                  data.reason,
                  data.key,
                );
                setMessage(r.error || ("message" in r ? r.message : "") || "");
                if (!r.error) {
                  setRequest(null);
                  setDelta(0);
                }
              } catch {
                setMessage("Connexion interrompue. Réessayez la même demande.");
              }
            });
          }}
        >
          <div className="adjust-preview">
            <div>
              <span>Disponible actuel</span>
              <strong>{current}</strong>
            </div>
            <span aria-hidden="true">→</span>
            <div>
              <span>Après ajustement</span>
              <strong>{current + delta}</strong>
            </div>
          </div>
          <label>
            Variation de quantité
            <input
              name="delta"
              type="number"
              value={delta}
              onChange={(e) => setDelta(Number(e.target.value))}
              min="-1000000"
              max="1000000"
              step="1"
              required
              disabled={pending || !!request}
            />
            <small>Nombre positif pour ajouter, négatif pour retirer.</small>
          </label>
          <label>
            Motif
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={pending || !!request}
            >
              {[
                "Comptage",
                "Correction",
                "Réception",
                "Endommagé",
                "Contrôle qualité",
                "Autre",
              ].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          {reason === "Autre" && (
            <label>
              Précisez le motif
              <input
                name="customReason"
                required
                maxLength={500}
                disabled={pending || !!request}
              />
            </label>
          )}{" "}
          {message && (
            <p className="action-message" role="status">
              {message}
            </p>
          )}
          <div className="dialog-actions">
            <button
              className="secondary-button"
              type="button"
              disabled={pending}
              onClick={() => dialog.current?.close()}
            >
              Fermer
            </button>
            <button disabled={pending}>
              {pending
                ? "Enregistrement…"
                : request
                  ? "Réessayer la même demande"
                  : "Enregistrer le mouvement"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

export function RetryAdjustment({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  return (
    <div>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await retryAction(id);
            setMessage(r.error || ("message" in r ? r.message : "") || "");
          })
        }
      >
        Reprendre la demande
      </button>
      <p role="status">{message}</p>
    </div>
  );
}
