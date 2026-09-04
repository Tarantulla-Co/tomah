import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/products";
import {
  QUOTE_STATUS_LABELS,
  QUOTE_STATUSES,
  listQuotes,
  type QuoteListResponse,
  type QuoteStatus,
} from "../../lib/quotes";
import { Badge, toneForStatus } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";

export function QuotesListPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = (params.get("status") as QuoteStatus | null) ?? null;
  const page = Number(params.get("page") ?? "1");
  const [search, setSearch] = useState(params.get("q") ?? "");

  const [resp, setResp] = useState<QuoteListResponse | null>(null);
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
    () => ({ q: params.get("q") ?? undefined, status: status ?? undefined, page }),
    [params, status, page],
  );

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    listQuotes(query, ac.signal)
      .then((r) => {
        setResp(r);
        setError(null);
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        setError(e instanceof ApiError ? e.message : "Failed to load quotes");
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [query]);

  function setStatus(s: QuoteStatus | null) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (s) next.set("status", s);
      else next.delete("status");
      next.delete("page");
      return next;
    });
  }

  const counts = resp?.statusCounts;

  return (
    <div className="stack">
      <div className="toolbar">
        <div>
          <h1 className="page-title">Quotes</h1>
          <p className="muted">
            Incoming requests and the quote builder. Approved quotes convert to invoices.
          </p>
        </div>
        <Button onClick={() => navigate("/quotes/new")}>New quote</Button>
      </div>

      <input
        className="input"
        style={{ maxWidth: 360 }}
        placeholder="Search quote #, customer or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="filter-row">
        <button className="chip" aria-pressed={!status} onClick={() => setStatus(null)}>
          All
        </button>
        {QUOTE_STATUSES.map((s) => (
          <button
            key={s}
            className="chip"
            aria-pressed={status === s}
            onClick={() => setStatus(status === s ? null : s)}
          >
            {QUOTE_STATUS_LABELS[s]}
            {counts && <span className="pill-count">{counts[s] ?? 0}</span>}
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
              <th>Quote #</th>
              <th>Customer</th>
              <th>Lines</th>
              <th>Total</th>
              <th>Valid until</th>
              <th>Status</th>
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
                  No quotes match these filters.
                </td>
              </tr>
            )}
            {resp?.data.map((q) => (
              <tr key={q.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/quotes/${q.id}`)}>
                <td style={{ fontWeight: 600 }}>{q.quoteNumber}</td>
                <td>
                  <div>{q.customer.companyName || q.customer.name}</div>
                  <div className="muted" style={{ fontSize: "var(--text-xs)" }}>{q.customer.email}</div>
                </td>
                <td className="muted">{q.lineItems.length}</td>
                <td>{q.total ? formatMoney(q.total, q.currency) : <span className="muted">—</span>}</td>
                <td className="muted">
                  {q.validUntil ? new Date(q.validUntil).toLocaleDateString() : "—"}
                </td>
                <td>
                  <Badge tone={toneForStatus(q.isExpired ? "EXPIRED" : q.status)}>
                    {q.isExpired ? "Expired" : QUOTE_STATUS_LABELS[q.status]}
                  </Badge>
                </td>
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
