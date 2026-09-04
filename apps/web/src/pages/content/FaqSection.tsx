import { useEffect, useState } from "react";
import { ApiError } from "../../lib/api";
import {
  createFaq,
  deleteFaq,
  listFaqs,
  updateFaq,
  type Faq,
} from "../../lib/content";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";

type Draft = { question: string; answer: string; category: string; position: string };
const EMPTY: Draft = { question: "", answer: "", category: "", position: "0" };

export function FaqSection() {
  const [items, setItems] = useState<Faq[]>([]);
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
      const r = await listFaqs({ sort: "position" });
      setItems(r.data);
      setCounts(r.counts);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load FAQs");
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
    question: d.question.trim(),
    answer: d.answer.trim(),
    category: d.category.trim() || null,
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
        <Button onClick={() => setAdding((v) => !v)}>{adding ? "Close" : "Add FAQ"}</Button>
      </div>

      {adding && (
        <div className="card">
          <div className="card__header">New FAQ</div>
          <div className="card__body">
            <div className="form-grid">
              <Field label="Question" className="col-span-2">
                <input
                  className="input"
                  value={draft.question}
                  onChange={(e) => setDraft({ ...draft, question: e.target.value })}
                />
              </Field>
              <Field label="Answer" className="col-span-2">
                <textarea
                  className="textarea"
                  value={draft.answer}
                  onChange={(e) => setDraft({ ...draft, answer: e.target.value })}
                />
              </Field>
              <Field label="Category" hint="Optional grouping, e.g. Shipping">
                <input
                  className="input"
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
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
                disabled={!draft.question.trim() || !draft.answer.trim()}
                onClick={() =>
                  run(async () => {
                    await createFaq(toPayload(draft));
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
              <th>Question</th>
              <th>Category</th>
              <th>Pos</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="muted" style={{ textAlign: "center", padding: "var(--space-6)" }}>
                  Loading…
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="muted" style={{ textAlign: "center", padding: "var(--space-6)" }}>
                  No FAQs yet.
                </td>
              </tr>
            )}
            {items.map((f) =>
              editingId === f.id ? (
                <tr key={f.id}>
                  <td colSpan={3}>
                    <input
                      className="input"
                      value={buf.question}
                      onChange={(e) => setBuf({ ...buf, question: e.target.value })}
                    />
                    <textarea
                      className="textarea"
                      style={{ marginTop: 4 }}
                      value={buf.answer}
                      onChange={(e) => setBuf({ ...buf, answer: e.target.value })}
                    />
                    <div className="row" style={{ marginTop: 4 }}>
                      <input
                        className="input"
                        placeholder="Category"
                        value={buf.category}
                        onChange={(e) => setBuf({ ...buf, category: e.target.value })}
                      />
                      <input
                        className="input"
                        style={{ width: 90 }}
                        type="number"
                        min={0}
                        value={buf.position}
                        onChange={(e) => setBuf({ ...buf, position: e.target.value })}
                      />
                    </div>
                  </td>
                  <td>
                    <Badge tone={f.isPublished ? "success" : "pending"}>
                      {f.isPublished ? "Published" : "Draft"}
                    </Badge>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <Button
                      variant="ghost"
                      loading={busy}
                      onClick={() =>
                        run(async () => {
                          await updateFaq(f.id, toPayload(buf));
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
                <tr key={f.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{f.question}</div>
                    <div className="muted" style={{ fontSize: "var(--text-xs)" }}>{f.answer}</div>
                  </td>
                  <td className="muted">{f.category ?? "—"}</td>
                  <td className="muted">{f.position}</td>
                  <td>
                    <Badge tone={f.isPublished ? "success" : "pending"}>
                      {f.isPublished ? "Published" : "Draft"}
                    </Badge>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <Button
                      variant="ghost"
                      onClick={() => run(() => updateFaq(f.id, { isPublished: !f.isPublished }))}
                    >
                      {f.isPublished ? "Unpublish" : "Publish"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditingId(f.id);
                        setBuf({
                          question: f.question,
                          answer: f.answer,
                          category: f.category ?? "",
                          position: String(f.position),
                        });
                      }}
                    >
                      Edit
                    </Button>
                    <Button variant="ghost" onClick={() => run(() => deleteFaq(f.id))}>
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
