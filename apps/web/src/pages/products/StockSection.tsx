import { useState } from "react";
import { ApiError } from "../../lib/api";
import { updateStock, type Product } from "../../lib/products";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";

/**
 * Manual stock override. Every save stamps stockSource = MANUAL and updates
 * stockUpdatedAt. "Lock" (stockSyncEnabled = false) tells the future
 * accounting-sync job to leave this product alone.
 */
export function StockSection({
  product,
  readOnly,
  onChange,
}: {
  product: Product;
  readOnly: boolean;
  onChange: (p: Product) => void;
}) {
  const [qty, setQty] = useState(String(product.stock.quantity));
  const [note, setNote] = useState("");
  const [locked, setLocked] = useState(!product.stock.syncEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    Number(qty) !== product.stock.quantity || locked === product.stock.syncEnabled || note.trim() !== "";

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateStock(product.id, {
        stockQuantity: Number(qty),
        stockSyncEnabled: !locked,
        note: note.trim() || undefined,
      });
      onChange(updated);
      setNote("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update stock");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="card__header">Stock</div>
      <div className="card__body">
        <div className="row" style={{ marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
          <span className="metric__value" style={{ fontSize: "var(--text-xl)" }}>
            {product.stock.quantity}
          </span>
          <Badge tone={product.stock.source === "MANUAL" ? "neutral" : "success"}>
            {product.stock.source === "MANUAL" ? "Manual" : "Accounting sync"}
          </Badge>
          {!product.stock.syncEnabled && <Badge tone="pending">Sync locked</Badge>}
          <span className="muted" style={{ fontSize: "var(--text-xs)" }}>
            updated {new Date(product.stock.updatedAt).toLocaleString()}
          </span>
        </div>

        {!readOnly && (
          <div className="form-grid">
            <Field label="New quantity">
              <input
                className="input"
                inputMode="numeric"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </Field>
            <Field label="Note (optional)" hint="Recorded in the audit log">
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <div className="switch-row col-span-2">
              <input
                type="checkbox"
                id="lockStock"
                checked={locked}
                onChange={(e) => setLocked(e.target.checked)}
              />
              <label htmlFor="lockStock">
                Lock — keep this manual figure even when the accounting sync runs
              </label>
            </div>
            <div className="col-span-2">
              <Button onClick={save} loading={saving} disabled={!dirty}>
                Update stock
              </Button>
            </div>
          </div>
        )}

        {error && <div className="field-error">{error}</div>}
      </div>
    </div>
  );
}
