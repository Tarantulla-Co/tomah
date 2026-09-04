import { useEffect, useState } from "react";
import { ApiError } from "../../lib/api";
import {
  createTestimonial,
  deleteTestimonial,
  listTestimonials,
  updateTestimonial,
  type Testimonial,
} from "../../lib/content";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";

type Draft = { authorName: string; authorTitle: string; quote: string; rating: string; position: string };
const EMPTY: Draft = { authorName: "", authorTitle: "", quote: "", rating: "", position: "0" };

export function TestimonialSection() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [counts, setCounts] = useState({ published: 0, draft: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [buf, setBuf] = useState<Draft>(EMPTY);

  async function load() {
    setLoading(true);
    try {
      const r = await listTestimonials({ sort: "position" });
      setItems(r.data);
      setCounts(r.counts);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load testimonials");
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

  const toPayload = (d: Draft) => ({
    authorName: d.authorName.trim(),
    authorTitle: d.authorTitle.trim() || null,
    quote: d.quote.trim(),
    rating: d.rating.trim() === "" ? null : Number(d.rating),
    position: Number(d.position) || 0,
  });

  return (
    <div className="stack">
      {error && (
        <div className="card">
          <div className="card__body" style={{ color: "var(--status-danger-fg)" }}>{error}</div>
        </div>
      )}

      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="muted">
          {counts.published} published · {counts.draft} draft
        </span>
        <Button onClick={() => setAdding((v) => !v)}>{adding ? "Close" : "Add testimonial"}</Button>
      </div>

      {adding && (
        <div className="card">
          <div className="card__header">New testimonial</div>
          <div className="card__body">
            <div className="form-grid">
              <Field label="Author name">
                <input
                  className="input"
                  value={draft.authorName}
                  onChange={(e) => setDraft({ ...draft, authorName: e.target.value })}
                />
              </Field>
              <Field label="Author title" hint="e.g. Head Chef, Northbay Grill">
                <input
                  className="input"
                  value={draft.authorTitle}
                  onChange={(e) => setDraft({ ...draft, authorTitle: e.target.value })}
                />
              </Field>
              <Field label="Quote" className="col-span-2">
                <textarea
                  className="textarea"
                  value={draft.quote}
                  onChange={(e) => setDraft({ ...draft, quote: e.target.value })}
                />
              </Field>
              <Field label="Rating (1–5)">
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={5}
                  value={draft.rating}
                  onChange={(e) => setDraft({ ...draft, rating: e.target.value })}
                />
              </Field>
              <Field label="Position">
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={draft.position}
                  onChange={(e) => setDraft({ ...draft, position: e.target.value })}
                />
              </Field>
            </div>
            <div className="row" style={{ marginTop: "var(--space-3)" }}>
              <Button
                loading={busy}
                disabled={!draft.authorName.trim() || !draft.quote.trim()}
                onClick={() =>
                  run(async () => {
                    await createTestimonial(toPayload(draft));
                    setDraft(EMPTY);
                    setAdding(false);
                  })
                }
              >
                Create (draft)
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Author</th>
              <th>Quote</th>
              <th>Rating</th>
              <th>Pos</th>
              <th>Status</th>
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
                  No testimonials yet.
                </td>
              </tr>
            )}
            {items.map((t) =>
              editingId === t.id ? (
                <tr key={t.id}>
                  <td colSpan={4}>
                    <div className="row">
                      <input
                        className="input"
                        placeholder="Author name"
                        value={buf.authorName}
                        onChange={(e) => setBuf({ ...buf, authorName: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="Author title"
                        value={buf.authorTitle}
                        onChange={(e) => setBuf({ ...buf, authorTitle: e.target.value })}
                      />
                    </div>
                    <textarea
                      className="textarea"
                      style={{ marginTop: 4 }}
                      value={buf.quote}
                      onChange={(e) => setBuf({ ...buf, quote: e.target.value })}
                    />
                    <div className="row" style={{ marginTop: 4 }}>
                      <input
                        className="input"
                        style={{ width: 90 }}
                        type="number"
                        min={1}
                        max={5}
                        placeholder="Rating"
                        value={buf.rating}
                        onChange={(e) => setBuf({ ...buf, rating: e.target.value })}
                      />
                      <input
                        className="input"
                        style={{ width: 90 }}
                        type="number"
                        min={0}
                        placeholder="Pos"
                        value={buf.position}
                        onChange={(e) => setBuf({ ...buf, position: e.target.value })}
                      />
                    </div>
                  </td>
                  <td>
                    <Badge tone={t.isPublished ? "success" : "pending"}>
                      {t.isPublished ? "Published" : "Draft"}
                    </Badge>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <Button
                      variant="ghost"
                      loading={busy}
                      onClick={() =>
                        run(async () => {
                          await updateTestimonial(t.id, toPayload(buf));
                          setEditingId(null);
                        })
                      }
                    >
                      Save
                    </Button>
                    <Button variant="ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </td>
                </tr>
              ) : (
                <tr key={t.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{t.authorName}</div>
                    <div className="muted" style={{ fontSize: "var(--text-xs)" }}>{t.authorTitle ?? "—"}</div>
                  </td>
                  <td className="muted">{t.quote}</td>
                  <td>{t.rating ? "★".repeat(t.rating) : "—"}</td>
                  <td className="muted">{t.position}</td>
                  <td>
                    <Badge tone={t.isPublished ? "success" : "pending"}>
                      {t.isPublished ? "Published" : "Draft"}
                    </Badge>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <Button
                      variant="ghost"
                      onClick={() => run(() => updateTestimonial(t.id, { isPublished: !t.isPublished }))}
                    >
                      {t.isPublished ? "Unpublish" : "Publish"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditingId(t.id);
                        setBuf({
                          authorName: t.authorName,
                          authorTitle: t.authorTitle ?? "",
                          quote: t.quote,
                          rating: t.rating ? String(t.rating) : "",
                          position: String(t.position),
                        });
                      }}
                    >
                      Edit
                    </Button>
                    <Button variant="ghost" onClick={() => run(() => deleteTestimonial(t.id))}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
