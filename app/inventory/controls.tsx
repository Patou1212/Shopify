"use client";
import { useState, useTransition } from "react";
import { syncAction, adjustAction, retryAction } from "./actions";
export function SyncButton() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  return (
    <div>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await syncAction();
            setMessage(r.error || r.message || "");
          })
        }
      >
        {pending ? "Synchronisation en cours…" : "Synchroniser Shopify"}
      </button>
      <p role="status">{message}</p>
    </div>
  );
}
export function Adjustment({
  variantId,
  locationId,
}: {
  variantId: string;
  locationId: string;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [request, setRequest] = useState<{
    delta: number;
    reason: string;
    key: string;
  } | null>(null);
  return (
    <details>
      <summary>Ajuster</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const data = request ?? {
            delta: Number(form.get("delta")),
            reason: String(form.get("reason")),
            key: crypto.randomUUID(),
          };
          setRequest(data);
          start(async () => {
            const r = await adjustAction(
              variantId,
              locationId,
              data.delta,
              data.reason,
              data.key,
            );
            setMessage(r.error || r.message || "");
            if (!r.error) setRequest(null);
          });
        }}
      >
        <label>
          Variation (+ / −)
          <input
            name="delta"
            type="number"
            step="1"
            required
            min="-1000000"
            max="1000000"
            disabled={pending || !!request}
          />
        </label>
        <label>
          Motif
          <input
            name="reason"
            required
            maxLength={500}
            disabled={pending || !!request}
          />
        </label>
        <button disabled={pending}>
          {pending
            ? "Enregistrement…"
            : request
              ? "Réessayer la même demande"
              : "Appliquer"}
        </button>
        <p role="status">{message}</p>
      </form>
    </details>
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
            setMessage(r.error || r.message || "");
          })
        }
      >
        Reprendre la demande
      </button>
      <p role="status">{message}</p>
    </div>
  );
}
