import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/products";
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUSES,
  listInvoices,
  type InvoiceListResponse,
  type InvoiceStatus,
} from "../../lib/invoices";
import { Badge, toneForStatus } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";

export function InvoicesListPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = (params.get("status") as InvoiceStatus | null) ?? null;
  const page = Number(params.get("page") ?? "1");
  const [search, setSearch] = useState(params.get("q") ?? "");

  const [resp, setResp] = useState<InvoiceListResponse | null>(null);
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
    listInvoices(query, ac.signal)
      .then((r) => {
        setResp(r);
        setError(null);
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        setError(e instanceof ApiError ? e.message : "Failed to load invoices");
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [query]);

  function setStatus(s: InvoiceStatus | null) {
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
          <h1 className="page-title">Invoices</h1>
          <p className="muted">
            Status tracking and payment recording. Online collection (Stripe) is configured on the API.
          </p>
        </div>
        <Button onClick={() => navigate("/invoices/new")}>New invoice</Button>
      </div>

      <input
        className="input"
        style={{ maxWidth: 360 }}
        placeholder="Search invoice #, quote #, customer or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="filter-row">
        <button className="chip" aria-pressed={!status} onClick={() => setStatus(null)}>
          All
        </button>
        {INVOICE_STATUSES.map((s) => (
          <button
            key={s}
            className="chip"
            aria-pressed={status === s}
            onClick={() => setStatus(status === s ? null : s)}
          >
            {INVOICE_STATUS_LABELS[s]}
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
              <th>Invoice #</th>
              <th>Customer</th>
              <th>Issued</th>
              <th>Due</th>
              <th>Total</th>
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
                  No invoices match these filters.
                </td>
              </tr>
            )}
            {resp?.data.map((inv) => (
              <tr key={inv.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/invoices/${inv.id}`)}>
                <td>
                  <div style={{ fontWeight: 600 }}>{inv.invoiceNumber}</div>
                  {inv.quote && (
                    <div className="muted" style={{ fontSize: "var(--text-xs)" }}>from {inv.quote.quoteNumber}</div>
                  )}
                </td>
                <td>
                  <div>{inv.customer.companyName || inv.customer.name}</div>
                  <div className="muted" style={{ fontSize: "var(--text-xs)" }}>{inv.customer.email}</div>
                </td>
                <td className="muted">{new Date(inv.issueDate).toLocaleDateString()}</td>
                <td className="muted">
                  {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}
                </td>
                <td>{formatMoney(inv.total, inv.currency)}</td>
                <td>
                  <Badge tone={toneForStatus(inv.isOverdue && inv.status === "SENT" ? "OVERDUE" : inv.status)}>
                    {inv.isOverdue && inv.status === "SENT" ? "Overdue" : INVOICE_STATUS_LABELS[inv.status]}
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
