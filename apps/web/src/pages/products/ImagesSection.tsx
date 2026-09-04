import { useRef, useState } from "react";
import { ApiError } from "../../lib/api";
import {
  addImage,
  deleteImage,
  updateImage,
  uploadImage,
  type Product,
} from "../../lib/products";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";

/**
 * Images can be added two ways:
 *   • upload a file  — stored via the API's storage adapter (local disk today,
 *     swappable to S3/GCS later) and served back as a URL
 *   • paste a URL    — an already-hosted external image, left untouched on delete
 */
export function ImagesSection({
  product,
  readOnly,
  onChange,
}: {
  product: Product;
  readOnly: boolean;
  onChange: (p: Product) => void;
}) {
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function run(fn: () => Promise<Product>, resetForm = false) {
    setBusy(true);
    setError(null);
    try {
      onChange(await fn());
      if (resetForm) {
        setUrl("");
        setAlt("");
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Image operation failed");
    } finally {
      setBusy(false);
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    await run(
      () =>
        uploadImage(product.id, file, {
          altText: alt.trim() || undefined,
          isPrimary: product.images.length === 0,
        }),
      true,
    );
  }

  return (
    <div className="card">
      <div className="card__header">
        Images
        <span className="muted" style={{ fontWeight: 400, marginLeft: 8 }}>
          {product.images.length}
        </span>
      </div>
      <div className="card__body stack">
        {error && <div className="field-error">{error}</div>}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: "var(--space-4)",
          }}
        >
          {product.images.map((img) => (
            <div key={img.id} className="card" style={{ overflow: "hidden" }}>
              <div
                style={{
                  aspectRatio: "4 / 3",
                  background: `center / cover no-repeat url(${JSON.stringify(img.url)}), var(--color-surface-alt)`,
                }}
              />
              <div className="card__body" style={{ padding: "var(--space-3)" }}>
                <div className="muted" style={{ fontSize: "var(--text-xs)", wordBreak: "break-all" }}>
                  {img.altText || <span>no alt text</span>}
                </div>
                {!readOnly && (
                  <div className="row" style={{ marginTop: "var(--space-2)" }}>
                    <button
                      className="chip"
                      aria-pressed={img.isPrimary}
                      onClick={() =>
                        !img.isPrimary && run(() => updateImage(product.id, img.id, { isPrimary: true }))
                      }
                    >
                      {img.isPrimary ? "Primary" : "Set primary"}
                    </button>
                    <button className="chip" onClick={() => run(() => deleteImage(product.id, img.id))}>
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {product.images.length === 0 && (
            <p className="muted">No images yet.</p>
          )}
        </div>

        {!readOnly && (
          <div className="stack">
            <div className="filter-row">
              <button className="chip" aria-pressed={mode === "upload"} onClick={() => setMode("upload")}>
                Upload file
              </button>
              <button className="chip" aria-pressed={mode === "url"} onClick={() => setMode("url")}>
                Paste URL
              </button>
            </div>

            <div className="form-grid">
              <Field label="Alt text" className="col-span-2">
                <input className="input" value={alt} onChange={(e) => setAlt(e.target.value)} />
              </Field>

              {mode === "upload" ? (
                <div className="col-span-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                    hidden
                    onChange={onPickFile}
                  />
                  <Button variant="secondary" loading={busy} onClick={() => fileRef.current?.click()}>
                    Choose image…
                  </Button>
                  <p className="field-hint">JPEG, PNG, WebP, GIF or AVIF. Stored via the configured storage adapter.</p>
                </div>
              ) : (
                <>
                  <Field label="Image URL" className="col-span-2" hint="Link to an already-hosted image">
                    <input
                      className="input"
                      value={url}
                      placeholder="https://…"
                      onChange={(e) => setUrl(e.target.value)}
                    />
                  </Field>
                  <div className="col-span-2">
                    <Button
                      variant="secondary"
                      loading={busy}
                      disabled={!url.trim()}
                      onClick={() =>
                        run(
                          () =>
                            addImage(product.id, {
                              url: url.trim(),
                              altText: alt.trim() || null,
                              isPrimary: product.images.length === 0,
                            }),
                          true,
                        )
                      }
                    >
                      Add image
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
