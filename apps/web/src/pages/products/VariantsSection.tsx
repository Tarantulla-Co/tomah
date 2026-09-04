import { useState } from "react";
import { ApiError } from "../../lib/api";
import {
  addVariant,
  deleteVariant,
  updateVariant,
  type Product,
  type ProductVariant,
  type VariantPayload,
} from "../../lib/products";
import { Button } from "../../components/ui/Button";

const BLANK = {
  name: "",
  sku: "",
  retailPrice: "",
  wholesalePrice: "",
  minimumOrderQuantity: "",
  stockQuantity: "0",
};
type Draft = typeof BLANK;

function toPayload(d: Draft): VariantPayload {
  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  return {
    name: d.name.trim(),
    sku: d.sku.trim(),
    retailPrice: num(d.retailPrice) as never,
    wholesalePrice: num(d.wholesalePrice) as never,
    minimumOrderQuantity: num(d.minimumOrderQuantity) as never,
    stockQuantity: Number(d.stockQuantity || "0"),
  };
}

function draftFrom(v: ProductVariant): Draft {
  return {
    name: v.name,
    sku: v.sku,
    retailPrice: v.retailPrice ?? "",
    wholesalePrice: v.wholesalePrice ?? "",
    minimumOrderQuantity: v.minimumOrderQuantity?.toString() ?? "",
    stockQuantity: String(v.stockQuantity),
  };
}

export function VariantsSection({
  product,
  readOnly,
  onChange,
}: {
  product: Product;
  readOnly: boolean;
  onChange: (p: Product) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<Product>) {
    setBusy(true);
    setError(null);
    try {
      onChange(await fn());
      setEditing(null);
      setAdding(false);
      setDraft(BLANK);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Variant operation failed");
    } finally {
      setBusy(false);
    }
  }

  const cell = (k: keyof Draft, opts: { placeholder?: string; mode?: "decimal" | "numeric" } = {}) => (
    <input
      className="input"
      value={draft[k]}
      inputMode={opts.mode}
      placeholder={opts.placeholder}
      onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
    />
  );

  return (
    <div className="card">
      <div className="card__header">
        Size &amp; packaging variants
        <span className="muted" style={{ fontWeight: 400, marginLeft: 8 }}>
          {product.variants.length}
        </span>
      </div>
      <div className="card__body stack">
        {error && <div className="field-error">{error}</div>}

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th>Retail</th>
                <th>Wholesale</th>
                <th>MOQ</th>
                <th>Stock</th>
                {!readOnly && <th />}
              </tr>
            </thead>
            <tbody>
              {product.variants.length === 0 && !adding && (
                <tr>
                  <td colSpan={7} className="muted" style={{ textAlign: "center", padding: "var(--space-5)" }}>
                    No variants. The base product price applies.
                  </td>
                </tr>
              )}

              {product.variants.map((v) =>
                editing === v.id ? (
                  <tr key={v.id}>
                    <td>{cell("name")}</td>
                    <td>{cell("sku")}</td>
                    <td>{cell("retailPrice", { mode: "decimal", placeholder: "—" })}</td>
                    <td>{cell("wholesalePrice", { mode: "decimal", placeholder: "—" })}</td>
                    <td>{cell("minimumOrderQuantity", { mode: "numeric", placeholder: "—" })}</td>
                    <td>{cell("stockQuantity", { mode: "numeric" })}</td>
                    <td>
                      <div className="row">
                        <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
                        <Button
                          loading={busy}
                          onClick={() => run(() => updateVariant(product.id, v.id, toPayload(draft)))}
                        >
                          Save
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 600 }}>{v.name}</td>
                    <td>{v.sku}</td>
                    <td>{v.retailPrice ?? "—"}</td>
                    <td>{v.wholesalePrice ?? "—"}</td>
                    <td>{v.minimumOrderQuantity ?? "—"}</td>
                    <td>{v.stockQuantity}</td>
                    {!readOnly && (
                      <td>
                        <div className="row">
                          <button
                            className="chip"
                            onClick={() => {
                              setEditing(v.id);
                              setDraft(draftFrom(v));
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="chip"
                            onClick={() => run(() => deleteVariant(product.id, v.id))}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ),
              )}

              {adding && (
                <tr>
                  <td>{cell("name", { placeholder: "8 fl oz" })}</td>
                  <td>{cell("sku", { placeholder: "SKU-8OZ" })}</td>
                  <td>{cell("retailPrice", { mode: "decimal", placeholder: "—" })}</td>
                  <td>{cell("wholesalePrice", { mode: "decimal", placeholder: "—" })}</td>
                  <td>{cell("minimumOrderQuantity", { mode: "numeric", placeholder: "—" })}</td>
                  <td>{cell("stockQuantity", { mode: "numeric" })}</td>
                  <td>
                    <div className="row">
                      <Button variant="secondary" onClick={() => { setAdding(false); setDraft(BLANK); }}>
                        Cancel
                      </Button>
                      <Button
                        loading={busy}
                        onClick={() => run(() => addVariant(product.id, toPayload(draft)))}
                      >
                        Add
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!readOnly && !adding && (
          <div>
            <Button variant="secondary" onClick={() => { setAdding(true); setDraft(BLANK); }}>
              Add variant
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
