import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../../lib/api";
import {
  addFeatured,
  listFeatured,
  removeFeatured,
  reorderFeatured,
  updateFeatured,
  type FeaturedProduct,
} from "../../lib/content";
import { formatMoney, listProducts, type Product } from "../../lib/products";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";

export function FeaturedSection() {
  const [items, setItems] = useState<FeaturedProduct[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [pick, setPick] = useState("");
  const [note, setNote] = useState("");
  const [noteEdit, setNoteEdit] = useState<{ id: string; value: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [feat, prods] = await Promise.all([
        listFeatured(),
        listProducts({ pageSize: 100, sort: "name" }),
      ]);
      setItems(feat);
      setProducts(prods.data);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load featured products");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const featuredIds = useMemo(() => new Set(items.map((i) => i.productId)), [items]);
  const available = products.filter((p) => !featuredIds.has(p.id));

  function move(index: number, dir: -1 | 1) {
    const next = [...items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void run(() => reorderFeatured(next.map((i) => i.id)));
  }

  return (
    <div className="stack">
      {error && (
        <div className="card">
          <div className="card__body" style={{ color: "var(--status-danger-fg)" }}>{error}</div>
        </div>
      )}

      <div className="card">
        <div className="card__header">Add a featured product</div>
        <div className="card__body">
          <div className="form-grid" style={{ alignItems: "end" }}>
            <Field label="Product" className="col-span-2">
              <select className="select" value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">Select a product…</option>
                {available.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku}){p.isPublished ? "" : " — draft"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Note" hint="Internal only — not shown on the site">
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <div>
              <Button
                loading={busy}
                disabled={!pick}
                onClick={() =>
                  run(async () => {
                    await addFeatured({ productId: pick, note: note.trim() || null });
                    setPick("");
                    setNote("");
                  })
                }
              >
                Feature
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Order</th>
              <th>Product</th>
              <th>Retail price</th>
              <th>Published</th>
              <th>Note</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="muted" style={{ textAlign: "center", padding: "var(--space-6)" }}>
                  Loading…
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="muted" style={{ textAlign: "center", padding: "var(--space-6)" }}>
                  No featured products. The homepage will fall back to its default selection.
                </td>
              </tr>
            )}
            {items.map((f, i) => (
              <tr key={f.id}>
                <td style={{ whiteSpace: "nowrap" }}>
                  <Button variant="ghost" disabled={i === 0 || busy} onClick={() => move(i, -1)}>
                    ↑
                  </Button>
                  <Button variant="ghost" disabled={i === items.length - 1 || busy} onClick={() => move(i, 1)}>
                    ↓
                  </Button>
                </td>
                <td>
                  <div className="row">
                    {f.product.imageUrl && (
                      <img
                        src={f.product.imageUrl}
                        alt=""
                        style={{ width: 36, height: 36, objectFit: "cover", borderRadius: "var(--radius-sm)" }}
                      />
                    )}
                    <div>
                      <div style={{ fontWeight: 600 }}>{f.product.name}</div>
                      <div className="muted" style={{ fontSize: "var(--text-xs)" }}>{f.product.sku}</div>
                    </div>
                  </div>
                </td>
                <td>{formatMoney(f.product.retailPrice, f.product.currency)}</td>
                <td>
                  <Badge tone={f.product.isPublished ? "success" : "pending"}>
                    {f.product.isPublished ? "Published" : "Draft"}
                  </Badge>
                </td>
                <td>
                  {noteEdit?.id === f.id ? (
                    <input
                      className="input"
                      value={noteEdit.value}
                      onChange={(e) => setNoteEdit({ id: f.id, value: e.target.value })}
                    />
                  ) : (
                    <span className="muted">{f.note ?? "—"}</span>
                  )}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {noteEdit?.id === f.id ? (
                    <>
                      <Button
                        variant="ghost"
                        loading={busy}
                        onClick={() =>
                          run(async () => {
                            await updateFeatured(f.id, { note: noteEdit.value.trim() || null });
                            setNoteEdit(null);
                          })
                        }
                      >
                        Save
                      </Button>
                      <Button variant="ghost" onClick={() => setNoteEdit(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button variant="ghost" onClick={() => setNoteEdit({ id: f.id, value: f.note ?? "" })}>
                      Note
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => run(() => removeFeatured(f.id))}>
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
