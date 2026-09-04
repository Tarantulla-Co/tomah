import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/products";
import { CUSTOMER_TYPE_LABELS, getCustomer, type CustomerDetail } from "../../lib/customers";
import { Badge, toneForStatus } from "../../components/ui/Badge";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "var(--space-4)",
        padding: "6px 0",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div className="muted" style={{ width: 180, flexShrink: 0, fontSize: "var(--text-sm)" }}>{label}</div>
      <div>{value || <span className="muted">—</span>}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card">
      <div className="card__body">
        <div className="metric__value">{value}</div>
        <div className="metric__label">{label}</div>
      </div>
    </div>
  );
}

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [c, setC] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    getCustomer(id!, ac.signal)
      .then(setC)
      .catch((e) => {
        if (e.name === "AbortError") return;
        setError(e instanceof ApiError ? e.message : "Failed to load customer");
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [id]);

  if (loading) return <p className="muted">Loading…</p>;
  if (!c) return <p className="muted">{error ?? "Not found"}</p>;

  const cur = c.recentOrders[0]?.currency ?? c.recentInvoices[0]?.currency ?? "USD";

  return (
    <div className="stack">
      <div className="toolbar">
        <div>
          <button className="chip" onClick={() => navigate("/customers")}>
            ← Customers
          </button>
          <h1 className="page-title" style={{ marginTop: "var(--space-2)" }}>{c.name}</h1>
          <div className="row" style={{ marginTop: "var(--space-1)" }}>
            <Badge tone="neutral">{CUSTOMER_TYPE_LABELS[c.type]}</Badge>
            {c.wholesaleAccount && (
              <button
                className="chip"
                onClick={() => navigate(`/wholesale-accounts/${c.wholesaleAccount!.id}`)}
              >
                Wholesale: {c.wholesaleAccount.status}
              </button>
            )}
            {c.companyName && (
              <span className="muted" style={{ fontSize: "var(--text-xs)" }}>{c.companyName}</span>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="card">
          <div className="card__body" style={{ color: "var(--status-danger-fg)" }}>{error}</div>
        </div>
      )}

      <div className="grid-metrics">
        <Metric label="Lifetime spend" value={formatMoney(c.stats.lifetimeSpend, cur)} />
        <Metric label="Orders" value={c.stats.orders} />
        <Metric label="Open quotes" value={c.stats.openQuotes} />
        <Metric label="Unpaid invoices" value={c.stats.unpaidInvoices} />
        <Metric
          label={`Refunded (${c.stats.refundedOrders})`}
          value={formatMoney(c.stats.refundedTotal, cur)}
        />
      </div>

      <div className="card">
        <div className="card__header">Profile</div>
        <div className="card__body">
          <Row label="Email" value={c.email} />
          <Row label="Phone" value={c.phone} />
          <Row label="Company" value={c.companyName} />
          <Row label="Type" value={CUSTOMER_TYPE_LABELS[c.type]} />
          <Row label="Joined" value={new Date(c.createdAt).toLocaleDateString()} />
          {c.wholesaleAccount && (
            <Row
              label="Wholesale account"
              value={
                <>
                  <Badge tone={toneForStatus(c.wholesaleAccount.status)}>
                    {c.wholesaleAccount.status}
                  </Badge>{" "}
                  <button
                    className="chip"
                    onClick={() => navigate(`/wholesale-accounts/${c.wholesaleAccount!.id}`)}
                  >
                    {c.wholesaleAccount.businessName} →
                  </button>
                  {c.wholesaleAccount.reviewedBy && (
                    <span className="muted" style={{ fontSize: "var(--text-xs)" }}>
                      {" "}
                      reviewed by {c.wholesaleAccount.reviewedBy.name}
                    </span>
                  )}
                </>
              }
            />
          )}
        </div>
      </div>

      <div className="card">
        <div className="card__header">Saved addresses</div>
        <div className="card__body">
          {c.addresses.length === 0 && <p className="muted">No saved addresses.</p>}
          <div style={{ display: "flex", gap: "var(--space-6)", flexWrap: "wrap" }}>
            {c.addresses.map((a) => (
              <div key={a.id} style={{ fontSize: "var(--text-sm)", lineHeight: 1.6, minWidth: 200 }}>
                <div className="row" style={{ marginBottom: 4 }}>
                  <strong>{a.label ?? "Address"}</strong>
                  {a.isDefaultShipping && <Badge tone="neutral">Default ship</Badge>}
                  {a.isDefaultBilling && <Badge tone="neutral">Default bill</Badge>}
                </div>
                {a.contactName && <div>{a.contactName}</div>}
                <div>{a.line1}</div>
                {a.line2 && <div>{a.line2}</div>}
                <div>
                  {a.city}, {a.region} {a.postalCode}
                </div>
                <div>{a.country}</div>
                {a.phone && <div className="muted">{a.phone}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__header">Recent orders</div>
        <div className="table-wrap" style={{ border: 0 }}>
          <table className="data">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Placed</th>
                <th>Carrier</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {c.recentOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted" style={{ textAlign: "center", padding: "var(--space-5)" }}>
                    No orders.
                  </td>
                </tr>
              )}
              {c.recentOrders.map((o) => (
                <tr key={o.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/orders/${o.id}`)}>
                  <td style={{ fontWeight: 600 }}>{o.orderNumber}</td>
                  <td className="muted">{new Date(o.placedAt).toLocaleDateString()}</td>
                  <td className="muted">{o.carrier ?? "—"}</td>
                  <td>{formatMoney(o.total, o.currency)}</td>
                  <td>
                    <Badge tone={toneForStatus(o.status)}>{o.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card__header">Recent quotes</div>
        <div className="table-wrap" style={{ border: 0 }}>
          <table className="data">
            <thead>
              <tr>
                <th>Quote #</th>
                <th>Created</th>
                <th>Valid until</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {c.recentQuotes.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted" style={{ textAlign: "center", padding: "var(--space-5)" }}>
                    No quotes.
                  </td>
                </tr>
              )}
              {c.recentQuotes.map((q) => (
                <tr key={q.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/quotes/${q.id}`)}>
                  <td style={{ fontWeight: 600 }}>{q.quoteNumber}</td>
                  <td className="muted">{new Date(q.createdAt).toLocaleDateString()}</td>
                  <td className="muted">
                    {q.validUntil ? new Date(q.validUntil).toLocaleDateString() : "—"}
                  </td>
                  <td>{q.total ? formatMoney(q.total, q.currency) : "—"}</td>
                  <td>
                    <Badge tone={toneForStatus(q.status)}>{q.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card__header">Recent invoices</div>
        <div className="table-wrap" style={{ border: 0 }}>
          <table className="data">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Issued</th>
                <th>Due</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {c.recentInvoices.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted" style={{ textAlign: "center", padding: "var(--space-5)" }}>
                    No invoices.
                  </td>
                </tr>
              )}
              {c.recentInvoices.map((i) => (
                <tr key={i.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/invoices/${i.id}`)}>
                  <td style={{ fontWeight: 600 }}>{i.invoiceNumber}</td>
                  <td className="muted">{new Date(i.issueDate).toLocaleDateString()}</td>
                  <td className="muted">{i.dueDate ? new Date(i.dueDate).toLocaleDateString() : "—"}</td>
                  <td>{i.total ? formatMoney(i.total, i.currency) : "—"}</td>
                  <td>
                    <Badge tone={toneForStatus(i.status)}>{i.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
