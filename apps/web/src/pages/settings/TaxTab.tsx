import { useState } from "react";
import { ApiError } from "../../lib/api";
import { updateTax, type TaxSettings } from "../../lib/settings";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";

// Store rates as decimals (0.06); edit them as percentages (6).
const toPct = (r: number) => String(Math.round(r * 10000) / 100);
const fromPct = (s: string) => Math.round(Number(s || 0) * 100) / 10000;

export function TaxTab({ value, onSaved }: { value: TaxSettings; onSaved: () => void }) {
  const [defaultRate, setDefaultRate] = useState(toPct(value.defaultRate));
  const [rules, setRules] = useState<Array<{ region: string; rate: string }>>(
    value.rules.map((r) => ({ region: r.region, rate: toPct(r.rate) })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const setRule = (i: number, patch: Partial<{ region: string; rate: string }>) =>
    setRules((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await updateTax({
        defaultRate: fromPct(defaultRate),
        rules: rules
          .filter((r) => r.region.trim())
          .map((r) => ({ region: r.region.trim(), rate: fromPct(r.rate) })),
      });
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
      <div className="card__header">Tax rules per region</div>
      <div className="card__body stack">
        {error && <div style={{ color: "var(--status-danger-fg)" }}>{error}</div>}
        {saved && <div className="muted">Saved.</div>}

        <Field label="Default rate (%)" hint="Applied when no region rule matches">
          <input
            className="input"
            style={{ maxWidth: 160 }}
            type="number"
            min={0}
            step="0.01"
            value={defaultRate}
            onChange={(e) => setDefaultRate(e.target.value)}
          />
        </Field>

        <div className="stack">
          <strong style={{ fontSize: "var(--text-sm)" }}>Per-region rates</strong>
          {rules.map((r, i) => (
            <div key={i} className="row">
              <input
                className="input"
                placeholder="Region / state (e.g. VT)"
                value={r.region}
                onChange={(e) => setRule(i, { region: e.target.value })}
              />
              <input
                className="input"
                style={{ width: 120 }}
                type="number"
                min={0}
                step="0.01"
                value={r.rate}
                onChange={(e) => setRule(i, { rate: e.target.value })}
              />
              <span className="muted">%</span>
              <Button variant="ghost" onClick={() => setRules((rs) => rs.filter((_, idx) => idx !== i))}>
                Remove
              </Button>
            </div>
          ))}
          <div>
            <Button variant="secondary" onClick={() => setRules((rs) => [...rs, { region: "", rate: "0" }])}>
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
