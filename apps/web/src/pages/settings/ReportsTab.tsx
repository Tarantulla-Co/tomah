import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/products";
import {
  getReportSummary,
  getTopProducts,
  type ReportSummary,
  type TopProducts,
} from "../../lib/reports";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";

function Metric({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="card">
      <div className="card__body">
        <div className="metric__value">{value}</div>
        <div className="metric__label">{label}</div>
        {sub && <div className="muted" style={{ fontSize: "var(--text-xs)", marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function ReportsTab() {
  const defaults = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 29 * 86_400_000);
    return { from: iso(from), to: iso(to) };
  }, []);

  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [applied, setApplied] = useState(defaults);

  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [top, setTop] = useState<TopProducts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    Promise.all([
      getReportSummary(applied, ac.signal),
      getTopProducts({ ...applied, limit: 10 }, ac.signal),
    ])
      .then(([s, t]) => {
        setSummary(s);
        setTop(t);
        setError(null);
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        setError(e instanceof ApiError ? e.message : "Failed to load reports");
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [applied]);

  const cur = "USD";
  const channelTotal = summary
    ? Number(summary.byChannel.retail) + Number(summary.byChannel.wholesale)
    : 0;
  const retailPct = channelTotal ? (Number(summary!.byChannel.retail) / channelTotal) * 100 : 0;

  return (
    <div className="stack">
      <div className="card">
        <div className="card__body">
          <div className="form-grid" style={{ alignItems: "end" }}>
            <Field label="From">
              <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="To">
              <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
            <div>
              <Button onClick={() => setApplied({ from, to })} loading={loading}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="card">
          <div className="card__body" style={{ color: "var(--status-danger-fg)" }}>{error}</div>
        </div>
      )}

      {summary && (
        <>
          <div className="grid-metrics">
            <Metric label="Total revenue" value={formatMoney(summary.revenue.total, cur)} />
            <Metric
              label="Retail (orders)"
              value={formatMoney(summary.byChannel.retail, cur)}
              sub={`${summary.orders.count} orders · avg ${formatMoney(summary.orders.avgOrderValue, cur)}`}
            />
            <Metric
              label="Wholesale (orders + invoices)"
              value={formatMoney(summary.byChannel.wholesale, cur)}
              sub={`${summary.invoices.paid} invoices paid`}
            />
            <Metric
              label="Refunds"
              value={formatMoney(summary.refunds.total, cur)}
              sub={`${summary.refunds.count} orders`}
            />
            <Metric
              label="Outstanding invoices"
              value={formatMoney(summary.invoices.outstandingTotal, cur)}
              sub={`${summary.invoices.outstanding} unpaid`}
            />
            <Metric
              label="Quote conversion"
              value={`${Math.round(summary.quotes.conversionRate * 100)}%`}
              sub={`${summary.quotes.converted} of ${summary.quotes.sent} sent`}
            />
          </div>

          <div className="card">
            <div className="card__header">Revenue by channel</div>
            <div className="card__body stack">
              <div
                style={{
                  display: "flex",
                  height: 22,
                  borderRadius: "var(--radius-pill)",
                  overflow: "hidden",
                  background: "var(--color-surface-alt)",
                }}
                aria-hidden
              >
                <div style={{ width: `${retailPct}%`, background: "var(--color-blue)" }} />
                <div style={{ width: `${100 - retailPct}%`, background: "var(--color-steel)" }} />
              </div>
              <div className="row" style={{ fontSize: "var(--text-sm)" }}>
                <span>
                  <span style={{ color: "var(--color-blue)", fontWeight: 700 }}>■</span> Retail{" "}
                  {formatMoney(summary.byChannel.retail, cur)}
                </span>
                <span>
                  <span style={{ color: "var(--color-steel)", fontWeight: 700 }}>■</span> Wholesale{" "}
                  {formatMoney(summary.byChannel.wholesale, cur)}
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card__header">Monthly</div>
            <div className="table-wrap" style={{ border: 0 }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Retail</th>
                    <th>Wholesale</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.series.length === 0 && (
                    <tr>
                      <td colSpan={4} className="muted" style={{ textAlign: "center", padding: "var(--space-5)" }}>
                        No revenue in this range.
                      </td>
                    </tr>
                  )}
                  {summary.series.map((s) => (
                    <tr key={s.period}>
                      <td>{s.period}</td>
                      <td>{formatMoney(s.retail, cur)}</td>
                      <td>{formatMoney(s.wholesale, cur)}</td>
                      <td style={{ fontWeight: 600 }}>{formatMoney(s.total, cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {top && (
        <div className="card">
          <div className="card__header">Top products (by order revenue)</div>
          <div className="table-wrap" style={{ border: 0 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Units sold</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {top.products.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted" style={{ textAlign: "center", padding: "var(--space-5)" }}>
                      No order items in this range.
                    </td>
                  </tr>
                )}
                {top.products.map((p) => (
                  <tr key={p.sku}>
                    <td>{p.name}</td>
                    <td className="muted">{p.sku}</td>
                    <td>{p.unitsSold}</td>
                    <td>{formatMoney(p.revenue, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card__body">
            <p className="muted" style={{ fontSize: "var(--text-xs)" }}>
              Based on retail/wholesale order line items. Quote &amp; invoice lines aren't
              product-linked, so wholesale-via-invoice sales don't appear here.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
