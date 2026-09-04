import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/products";
import {
  CARRIER_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  listOrders,
  type OrderListResponse,
  type OrderStatus,
} from "../../lib/orders";
import { Badge, toneForStatus } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";

export function OrdersListPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = (params.get("status") as OrderStatus | null) ?? null;
  const page = Number(params.get("page") ?? "1");
  const [search, setSearch] = useState(params.get("q") ?? "");

  const [resp, setResp] = useState<OrderListResponse | null>(null);
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
    listOrders(query, ac.signal)
      .then((r) => {
        setResp(r);
        setError(null);
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        setError(e instanceof ApiError ? e.message : "Failed to load orders");
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [query]);

  function setStatus(s: OrderStatus | null) {
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
          <h1 className="page-title">Orders</h1>
          <p className="muted">
            Retail order fulfilment — carrier &amp; tracking, refunds, and status the storefront reads back.
          </p>
        </div>
      </div>

      <input
        className="input"
        style={{ maxWidth: 360 }}
        placeholder="Search order #, tracking, customer or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="filter-row">
        <button className="chip" aria-pressed={!status} onClick={() => setStatus(null)}>
          All
        </button>
        {ORDER_STATUSES.map((s) => (
          <button
            key={s}
            className="chip"
            aria-pressed={status === s}
            onClick={() => setStatus(status === s ? null : s)}
          >
            {ORDER_STATUS_LABELS[s]}
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
              <th>Order #</th>
              <th>Customer</th>
              <th>Placed</th>
              <th>Carrier</th>
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
                  No orders match these filters.
                </td>
              </tr>
            )}
            {resp?.data.map((o) => (
              <tr key={o.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/orders/${o.id}`)}>
                <td style={{ fontWeight: 600 }}>{o.orderNumber}</td>
                <td>
                  <div>{o.customer.name}</div>
                  <div className="muted" style={{ fontSize: "var(--text-xs)" }}>{o.customer.email}</div>
                </td>
                <td className="muted">{new Date(o.createdAt).toLocaleDateString()}</td>
                <td className="muted">
                  {o.shipping.carrier ? CARRIER_LABELS[o.shipping.carrier] : "—"}
                  {o.shipping.trackingNumber && (
                    <div style={{ fontSize: "var(--text-xs)" }}>{o.shipping.trackingNumber}</div>
                  )}
                </td>
                <td>{formatMoney(o.amounts.total, o.currency)}</td>
                <td>
                  <Badge tone={toneForStatus(o.status)}>{ORDER_STATUS_LABELS[o.status]}</Badge>
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
