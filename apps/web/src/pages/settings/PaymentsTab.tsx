import { useState } from "react";
import { ApiError } from "../../lib/api";
import { updatePayments, type PaymentsSettings } from "../../lib/settings";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";

export function PaymentsTab({ value, onSaved }: { value: PaymentsSettings; onSaved: () => void }) {
  const [publicKey, setPublicKey] = useState(value.publicKey ?? "");
  const [secretKey, setSecretKey] = useState("");
  const [testMode, setTestMode] = useState(value.testMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await updatePayments({
        publicKey: publicKey.trim() || null,
        ...(secretKey !== "" ? { secretKey } : {}),
        testMode,
      });
      setSecretKey("");
      setSaved(true);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="card__header">Stripe</div>
      <div className="card__body stack">
        {error && <div style={{ color: "var(--status-danger-fg)" }}>{error}</div>}
        {saved && <div className="muted">Saved.</div>}

        <div className="row">
          <span className="muted">Provider: {value.provider}</span>
          <Badge tone={value.online ? "success" : "pending"}>
            {value.online ? "Live collection" : "Manual recording only"}
          </Badge>
        </div>
        {!value.online && (
          <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
            Online collection is off (`PAYMENT_PROVIDER=manual`) — payments are recorded by
            hand. Set `PAYMENT_PROVIDER=stripe` with `STRIPE_SECRET_KEY` +
            `STRIPE_WEBHOOK_SECRET` on the API to switch on Stripe (cards, Apple Pay, Google Pay).
          </p>
        )}

        <div className="form-grid">
          <Field label="Public key" className="col-span-2">
            <input
              className="input"
              value={publicKey}
              placeholder="pk_test_…"
              onChange={(e) => setPublicKey(e.target.value)}
            />
          </Field>
          <Field
            label="Secret key"
            className="col-span-2"
            hint={
              value.secretKeySet
                ? "A secret is stored. Type a new one to replace it, or leave blank to keep it."
                : "Not set."
            }
          >
            <input
              className="input"
              type="password"
              value={secretKey}
              placeholder={value.secretKeySet ? "•••••••• (unchanged)" : "sk_test_…"}
              onChange={(e) => setSecretKey(e.target.value)}
            />
          </Field>
        </div>

        <label className="switch-row">
          <input type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} />
          Test mode
        </label>

        <div className="row">
          <Button onClick={save} loading={busy}>
            Save
          </Button>
          {value.secretKeySet && (
            <Button
              variant="ghost"
              loading={busy}
              onClick={() =>
                updatePayments({ secretKey: "" })
                  .then(() => {
                    setSaved(true);
                    onSaved();
                  })
                  .catch((e) => setError(e instanceof ApiError ? e.message : "Failed"))
              }
            >
              Clear stored secret
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
