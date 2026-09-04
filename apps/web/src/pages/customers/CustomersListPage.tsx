import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../../lib/api";
import {
  CUSTOMER_TYPE_LABELS,
  listCustomers,
  type CustomerListResponse,
} from "../../lib/customers";
import { Badge, toneForStatus } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";

type TypeFilter = "retail" | "wholesale";
const TYPES: TypeFilter[] = ["retail", "wholesale"];

export function CustomersListPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const type = (params.get("type") as TypeFilter | null) ?? null;
  const page = Number(params.get("page") ?? "1");
  const [search, setSearch] = useState(params.get("q") ?? "");

  const [resp, setResp] = useState<CustomerListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (search) next.set("q", search);
        else next.delete("q");
        next.delete("page");
        return next;
      });
    }, 350);
    return () => clearTimeout(t);
  }, [search, setParams]);

  const query = useMemo(
    () => ({ q: params.get("q") ?? undefined, type: type ?? undefined, page }),
    [params, type, page],
  );

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    listCustomers(query, ac.signal)
      .then((r) => {
        setResp(r);
        setError(null);
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        setError(e instanceof ApiError ? e.message : "Failed to load customers");
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [query]);

  function setType(t: TypeFilter | null) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (t) next.set("type", t);
      else next.delete("type");
      next.delete("page");
      return next;
    });
  }

  const counts = resp?.typeCounts;

  return (
    <div className="stack">
      <div className="toolbar">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="muted">
            Unified retail &amp; wholesale directory. Records come from storefront checkout and
            application intake.
          </p>
        </div>
      </div>

      <input
        className="input"
        style={{ maxWidth: 360 }}
        placeholder="Search name, email or company…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="filter-row">
        <button className="chip" aria-pressed={!type} onClick={() => setType(null)}>
          All
        </button>
        {TYPES.map((t) => (
          <button
            key={t}
            className="chip"
            aria-pressed={type === t}
            onClick={() => setType(type === t ? null : t)}
          >
            {CUSTOMER_TYPE_LABELS[t === "retail" ? "RETAIL" : "WHOLESALE"]}
            {counts && (
              <span className="pill-count">
                {t === "retail" ? counts.RETAIL ?? 0 : counts.WHOLESALE ?? 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="card">
          <div className="card__body" style={{ color: "var(--status-danger-fg)" }}>{error}</div>
        </div>
      )}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Company</th>
              <th>Orders</th>
              <th>Quotes</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {loading && !resp && (
              <tr>
                <td colSpan={6} className="muted" style={{ textAlign: "center", padding: "var(--space-6)" }}>
                  Loading…
                </td>
              </tr>
            )}
            {resp?.data.length === 0 && (
              <tr>
                <td colSpan={6} className="muted" style={{ textAlign: "center", padding: "var(--space-6)" }}>
                  No customers match these filters.
                </td>
              </tr>
            )}
            {resp?.data.map((c) => (
              <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/customers/${c.id}`)}>
                <td>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div className="muted" style={{ fontSize: "var(--text-xs)" }}>{c.email}</div>
                </td>
                <td>
                  <Badge tone="neutral">{CUSTOMER_TYPE_LABELS[c.type]}</Badge>
                  {c.wholesale.hasAccount && c.wholesale.status && (
                    <div style={{ marginTop: 4 }}>
                      <Badge tone={toneForStatus(c.wholesale.status)}>{c.wholesale.status}</Badge>
                    </div>
                  )}
                </td>
                <td className="muted">{c.companyName ?? "—"}</td>
                <td>{c.counts.orders}</td>
                <td>{c.counts.quotes}</td>
                <td className="muted">{new Date(c.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resp && resp.pagination.pageCount > 1 && (
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <Button
            variant="secondary"
            disabled={page <= 1}
            onClick={() =>
              setParams((p) => {
                const n = new URLSearchParams(p);
                n.set("page", String(page - 1));
                return n;
              })
            }
          >
            Previous
          </Button>
          <span className="muted">
            Page {resp.pagination.page} of {resp.pagination.pageCount}
          </span>
          <Button
            variant="secondary"
            disabled={page >= resp.pagination.pageCount}
            onClick={() =>
              setParams((p) => {
                const n = new URLSearchParams(p);
                n.set("page", String(page + 1));
                return n;
              })
            }
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
