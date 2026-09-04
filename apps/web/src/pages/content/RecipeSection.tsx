import { useEffect, useState } from "react";
import { ApiError } from "../../lib/api";
import {
  createRecipe,
  deleteRecipe,
  listRecipes,
  updateRecipe,
  type Recipe,
} from "../../lib/content";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";

type Draft = {
  title: string;
  summary: string;
  imageUrl: string;
  ingredients: string;
  steps: string;
  position: string;
};
const EMPTY: Draft = { title: "", summary: "", imageUrl: "", ingredients: "", steps: "", position: "0" };

const linesToArray = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);
const arrayToLines = (a: string[]) => a.join("\n");

function RecipeForm({
  value,
  onChange,
}: {
  value: Draft;
  onChange: (d: Draft) => void;
}) {
  return (
    <div className="form-grid">
      <Field label="Title" className="col-span-2">
        <input className="input" value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} />
      </Field>
      <Field label="Summary" className="col-span-2">
        <input className="input" value={value.summary} onChange={(e) => onChange({ ...value, summary: e.target.value })} />
      </Field>
      <Field label="Image URL" className="col-span-2">
        <input className="input" value={value.imageUrl} onChange={(e) => onChange({ ...value, imageUrl: e.target.value })} />
      </Field>
      <Field label="Ingredients (one per line)">
        <textarea
          className="textarea"
          value={value.ingredients}
          onChange={(e) => onChange({ ...value, ingredients: e.target.value })}
        />
      </Field>
      <Field label="Steps (one per line)">
        <textarea
          className="textarea"
          value={value.steps}
          onChange={(e) => onChange({ ...value, steps: e.target.value })}
        />
      </Field>
      <Field label="Position">
        <input
          className="input"
          type="number"
          min={0}
          value={value.position}
          onChange={(e) => onChange({ ...value, position: e.target.value })}
        />
      </Field>
    </div>
  );
}

export function RecipeSection() {
  const [items, setItems] = useState<Recipe[]>([]);
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
      const r = await listRecipes({ sort: "position" });
      setItems(r.data);
      setCounts(r.counts);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load recipes");
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
    title: d.title.trim(),
    summary: d.summary.trim() || null,
    imageUrl: d.imageUrl.trim() || null,
    ingredients: linesToArray(d.ingredients),
    steps: linesToArray(d.steps),
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
        <Button onClick={() => setAdding((v) => !v)}>{adding ? "Close" : "Add recipe"}</Button>
      </div>

      {adding && (
        <div className="card">
          <div className="card__header">New recipe</div>
          <div className="card__body">
            <RecipeForm value={draft} onChange={setDraft} />
            <div className="row" style={{ marginTop: "var(--space-3)" }}>
              <Button
                loading={busy}
                disabled={!draft.title.trim()}
                onClick={() =>
                  run(async () => {
                    await createRecipe(toPayload(draft));
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

      <div className="stack">
        {loading && items.length === 0 && <p className="muted">Loading…</p>}
        {!loading && items.length === 0 && <p className="muted">No recipes yet.</p>}
        {items.map((r) => (
          <div className="card" key={r.id}>
            {editingId === r.id ? (
              <div className="card__body">
                <RecipeForm value={buf} onChange={setBuf} />
                <div className="row" style={{ marginTop: "var(--space-3)" }}>
                  <Button
                    loading={busy}
                    onClick={() =>
                      run(async () => {
                        await updateRecipe(r.id, toPayload(buf));
                        setEditingId(null);
                      })
                    }
                  >
                    Save
                  </Button>
                  <Button variant="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="card__header row" style={{ justifyContent: "space-between" }}>
                  <span>
                    {r.title}{" "}
                    <Badge tone={r.isPublished ? "success" : "pending"}>
                      {r.isPublished ? "Published" : "Draft"}
                    </Badge>
                  </span>
                  <span className="muted" style={{ fontSize: "var(--text-xs)" }}>pos {r.position} · /{r.slug}</span>
                </div>
                <div className="card__body stack">
                  {r.summary && <p className="muted">{r.summary}</p>}
                  <div className="row" style={{ alignItems: "flex-start", gap: "var(--space-6)", flexWrap: "wrap" }}>
                    <div>
                      <strong style={{ fontSize: "var(--text-sm)" }}>Ingredients</strong>
                      <ul style={{ margin: "4px 0 0 18px" }}>
                        {r.ingredients.map((it, i) => (
                          <li key={i}>{it}</li>
                        ))}
                        {r.ingredients.length === 0 && <li className="muted">—</li>}
                      </ul>
                    </div>
                    <div>
                      <strong style={{ fontSize: "var(--text-sm)" }}>Steps</strong>
                      <ol style={{ margin: "4px 0 0 18px" }}>
                        {r.steps.map((it, i) => (
                          <li key={i}>{it}</li>
                        ))}
                        {r.steps.length === 0 && <li className="muted">—</li>}
                      </ol>
                    </div>
                  </div>
                  <div className="row">
                    <Button
                      variant="ghost"
                      onClick={() => run(() => updateRecipe(r.id, { isPublished: !r.isPublished }))}
                    >
                      {r.isPublished ? "Unpublish" : "Publish"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditingId(r.id);
                        setBuf({
                          title: r.title,
                          summary: r.summary ?? "",
                          imageUrl: r.imageUrl ?? "",
                          ingredients: arrayToLines(r.ingredients),
                          steps: arrayToLines(r.steps),
                          position: String(r.position),
                        });
                      }}
                    >
                      Edit
                    </Button>
                    <Button variant="ghost" onClick={() => run(() => deleteRecipe(r.id))}>
                      Delete
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
