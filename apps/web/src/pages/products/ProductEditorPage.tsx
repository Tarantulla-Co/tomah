import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import {
  CATEGORY_LABELS,
  PRODUCT_CATEGORIES,
  createProduct,
  deleteProduct,
  getProduct,
  updateProduct,
  type Product,
  type ProductCategory,
  type ProductWritePayload,
} from "../../lib/products";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { TagInput } from "../../components/ui/TagInput";
import { StockSection } from "./StockSection";
import { VariantsSection } from "./VariantsSection";
import { ImagesSection } from "./ImagesSection";

interface FormState {
  name: string;
  sku: string;
  barcode: string;
  category: ProductCategory;
  countryOfOrigin: string;
  certifications: string[];
  shortDescription: string;
  longDescription: string;
  currency: string;
  retailPrice: string;
  wholesalePrice: string;
  minimumOrderQuantity: string;
  isRetailAvailable: boolean;
  isWholesaleAvailable: boolean;
  stockQuantity: string;
  isPublished: boolean;
}

const EMPTY: FormState = {
  name: "",
  sku: "",
  barcode: "",
  category: "MAPLE_PRODUCTS",
  countryOfOrigin: "",
  certifications: [],
  shortDescription: "",
  longDescription: "",
  currency: "USD",
  retailPrice: "",
  wholesalePrice: "",
  minimumOrderQuantity: "",
  isRetailAvailable: true,
  isWholesaleAvailable: false,
  stockQuantity: "0",
  isPublished: false,
};

function fromProduct(p: Product): FormState {
  return {
    name: p.name,
    sku: p.sku,
    barcode: p.barcode ?? "",
    category: p.category,
    countryOfOrigin: p.countryOfOrigin ?? "",
    certifications: p.certifications,
    shortDescription: p.shortDescription ?? "",
    longDescription: p.longDescription ?? "",
    currency: p.currency,
    retailPrice: p.retailPrice ?? "",
    wholesalePrice: p.wholesalePrice ?? "",
    minimumOrderQuantity: p.minimumOrderQuantity?.toString() ?? "",
    isRetailAvailable: p.isRetailAvailable,
    isWholesaleAvailable: p.isWholesaleAvailable,
    stockQuantity: p.stock.quantity.toString(),
    isPublished: p.isPublished,
  };
}

function toPayload(f: FormState, isNew: boolean): ProductWritePayload {
  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  const payload: ProductWritePayload = {
    name: f.name.trim(),
    sku: f.sku.trim(),
    barcode: f.barcode.trim() || null,
    category: f.category,
    countryOfOrigin: f.countryOfOrigin.trim() || null,
    certifications: f.certifications,
    shortDescription: f.shortDescription.trim() || null,
    longDescription: f.longDescription.trim() || null,
    currency: f.currency.trim().toUpperCase() || "USD",
    retailPrice: num(f.retailPrice),
    wholesalePrice: num(f.wholesalePrice),
    minimumOrderQuantity: f.minimumOrderQuantity.trim() === "" ? null : Number(f.minimumOrderQuantity),
    isRetailAvailable: f.isRetailAvailable,
    isWholesaleAvailable: f.isWholesaleAvailable,
    isPublished: f.isPublished,
  };
  // Stock is only set on create; afterwards it goes through the stock endpoint.
  if (isNew) payload.stockQuantity = Number(f.stockQuantity || "0");
  return payload;
}

export function ProductEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const readOnly = !hasRole("CONTENT_EDITOR");

  const [product, setProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) return;
    const ac = new AbortController();
    getProduct(id!, ac.signal)
      .then((p) => {
        setProduct(p);
        setForm(fromProduct(p));
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        setError(e instanceof ApiError ? e.message : "Failed to load product");
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [id, isNew]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        const created = await createProduct(toPayload(form, true));
        navigate(`/products/${created.id}`, { replace: true });
      } else {
        const updated = await updateProduct(id!, toPayload(form, false));
        setProduct(updated);
        setForm(fromProduct(updated));
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!id || !window.confirm("Delete this product? This cannot be undone.")) return;
    try {
      await deleteProduct(id);
      navigate("/products");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not delete");
    }
  }

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <div className="stack">
      <div className="toolbar">
        <div>
          <button className="chip" onClick={() => navigate("/products")}>
            ← Products
          </button>
          <h1 className="page-title" style={{ marginTop: "var(--space-2)" }}>
            {isNew ? "New product" : form.name || "Product"}
          </h1>
          {!isNew && product && (
            <p className="muted" style={{ fontSize: "var(--text-xs)" }}>
              /{product.slug} · updated {new Date(product.updatedAt).toLocaleString()}
            </p>
          )}
        </div>
        {!readOnly && (
          <div className="row">
            {!isNew && (
              <Button variant="danger" onClick={onDelete}>
                Delete
              </Button>
            )}
            <Button onClick={onSave} loading={saving}>
              {isNew ? "Create product" : "Save changes"}
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="card">
          <div className="card__body" style={{ color: "var(--status-danger-fg)" }}>{error}</div>
        </div>
      )}

      {readOnly && (
        <div className="card">
          <div className="card__body muted">
            You have read-only access to the catalogue. Editing requires the Content Editor role.
          </div>
        </div>
      )}

      {/* --- core details --- */}
      <div className="card">
        <div className="card__header">Details</div>
        <div className="card__body">
          <div className="form-grid">
            <Field label="Name" className="col-span-2">
              <input className="input" value={form.name} disabled={readOnly}
                onChange={(e) => set("name", e.target.value)} />
            </Field>

            <Field label="SKU" hint="Unique. Used by orders, quotes and the accounting sync.">
              <input className="input" value={form.sku} disabled={readOnly}
                onChange={(e) => set("sku", e.target.value)} />
            </Field>
            <Field label="Barcode (UPC/EAN)">
              <input className="input" value={form.barcode} disabled={readOnly}
                onChange={(e) => set("barcode", e.target.value)} />
            </Field>

            <Field label="Category">
              <select className="select" value={form.category} disabled={readOnly}
                onChange={(e) => set("category", e.target.value as ProductCategory)}>
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </Field>
            <Field label="Country of origin" hint="ISO code or free text, e.g. CA">
              <input className="input" value={form.countryOfOrigin} disabled={readOnly}
                onChange={(e) => set("countryOfOrigin", e.target.value)} />
            </Field>

            <Field label="Certifications" className="col-span-2"
              hint="e.g. USDA Organic, Halal, Canada Grade A">
              <TagInput value={form.certifications} onChange={(v) => set("certifications", v)} />
            </Field>

            <Field label="Short description" className="col-span-2">
              <textarea className="textarea" value={form.shortDescription} disabled={readOnly}
                onChange={(e) => set("shortDescription", e.target.value)} />
            </Field>
            <Field label="Long description" className="col-span-2">
              <textarea className="textarea" style={{ minHeight: 140 }} value={form.longDescription}
                disabled={readOnly} onChange={(e) => set("longDescription", e.target.value)} />
            </Field>
          </div>
        </div>
      </div>

      {/* --- pricing & channels --- */}
      <div className="card">
        <div className="card__header">Pricing &amp; channels</div>
        <div className="card__body">
          <div className="form-grid">
            <Field label="Currency">
              <input className="input" value={form.currency} disabled={readOnly}
                maxLength={3} onChange={(e) => set("currency", e.target.value.toUpperCase())} />
            </Field>
            <div />

            <Field label="Retail price" hint="Public. Shown on the storefront.">
              <input className="input" inputMode="decimal" value={form.retailPrice} disabled={readOnly}
                onChange={(e) => set("retailPrice", e.target.value)} placeholder="—" />
            </Field>
            <div className="switch-row" style={{ alignSelf: "end" }}>
              <input type="checkbox" id="retailAvail" checked={form.isRetailAvailable} disabled={readOnly}
                onChange={(e) => set("isRetailAvailable", e.target.checked)} />
              <label htmlFor="retailAvail">Available for retail checkout</label>
            </div>

            <Field label="Wholesale price"
              hint="Gated — only shown to approved wholesale accounts.">
              <input className="input" inputMode="decimal" value={form.wholesalePrice} disabled={readOnly}
                onChange={(e) => set("wholesalePrice", e.target.value)} placeholder="—" />
            </Field>
            <Field label="Minimum order quantity (MOQ)">
              <input className="input" inputMode="numeric" value={form.minimumOrderQuantity} disabled={readOnly}
                onChange={(e) => set("minimumOrderQuantity", e.target.value)} placeholder="—" />
            </Field>

            <div className="switch-row col-span-2">
              <input type="checkbox" id="wholesaleAvail" checked={form.isWholesaleAvailable} disabled={readOnly}
                onChange={(e) => set("isWholesaleAvailable", e.target.checked)} />
              <label htmlFor="wholesaleAvail">Available for wholesale quotes</label>
            </div>
          </div>
        </div>
      </div>

      {/* --- publish --- */}
      <div className="card">
        <div className="card__body">
          <div className="switch-row">
            <input type="checkbox" id="published" checked={form.isPublished} disabled={readOnly}
              onChange={(e) => set("isPublished", e.target.checked)} />
            <label htmlFor="published">
              <strong>Published</strong> — visible on the storefront
            </label>
          </div>
        </div>
      </div>

      {/* --- edit-only sections --- */}
      {isNew ? (
        <div className="card">
          <div className="card__body muted">
            Save the product first to manage stock, size variants and images.
          </div>
        </div>
      ) : (
        product && (
          <>
            <StockSection product={product} readOnly={readOnly} onChange={setProduct} />
            <VariantsSection product={product} readOnly={readOnly} onChange={setProduct} />
            <ImagesSection product={product} readOnly={readOnly} onChange={setProduct} />
          </>
        )
      )}
    </div>
  );
}
