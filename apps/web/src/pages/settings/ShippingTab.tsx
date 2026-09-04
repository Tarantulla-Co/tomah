import { useState } from "react";
import { ApiError } from "../../lib/api";
import { updateShipping, type ShippingSettings } from "../../lib/settings";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";

export function ShippingTab({ value, onSaved }: { value: ShippingSettings; onSaved: () => void }) {
  const [threshold, setThreshold] = useState(value.freeShippingThreshold ?? "");
  const [defaultFee, setDefaultFee] = useState(value.defaultFee);
  const [rules, setRules] = useState<Array<{ region: string; fee: string }>>(value.rules);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const setRule = (i: number, patch: Partial<{ region: string; fee: string }>) =>
    setRules((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await updateShipping({
        freeShippingThreshold: threshold.trim() === "" ? null : Number(threshold),
        defaultFee: Number(defaultFee),
        rules: rules
          .filter((r) => r.region.trim())
          .map((r) => ({ region: r.region.trim(), fee: Number(r.fee || 0) })),
      } as never);
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
      <div className="card__header">Shipping fee rules</div>
      <div className="card__body stack">
        {error && <div style={{ color: "var(--status-danger-fg)" }}>{error}</div>}
        {saved && <div className="muted">Saved.</div>}

        <div className="form-grid">
          <Field label="Free shipping over" hint="Order subtotal; blank disables free shipping">
            <input
              className="input"
              type="number"
              min={0}
              step="0.01"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </Field>
          <Field label="Default fee">
            <input
              className="input"
              type="number"
              min={0}
              step="0.01"
              value={defaultFee}
              onChange={(e) => setDefaultFee(e.target.value)}
            />
          </Field>
        </div>

        <div className="stack">
          <strong style={{ fontSize: "var(--text-sm)" }}>Per-region overrides</strong>
          {rules.map((r, i) => (
            <div key={i} className="row">
              <input
                className="input"
                placeholder="Region / state (e.g. AK)"
                value={r.region}
                onChange={(e) => setRule(i, { region: e.target.value })}
              />
              <input
                className="input"
                style={{ width: 140 }}
                type="number"
                min={0}
                step="0.01"
                value={r.fee}
                onChange={(e) => setRule(i, { fee: e.target.value })}
              />
              <Button variant="ghost" onClick={() => setRules((rs) => rs.filter((_, idx) => idx !== i))}>
                Remove
              </Button>
            </div>
          ))}
          <div>
            <Button variant="secondary" onClick={() => setRules((rs) => [...rs, { region: "", fee: "0" }])}>
              Add region
            </Button>
          </div>
        </div>

        <div>
          <Button onClick={save} loading={busy}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
