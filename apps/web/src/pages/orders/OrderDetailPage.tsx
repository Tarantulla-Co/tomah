import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/products";
import {
  CARRIER_LABELS,
  ORDER_STATUS_LABELS,
  SHIPPING_CARRIERS,
  cancelOrder,
  deliverOrder,
  getOrder,
  processOrder,
  refundOrder,
  shipOrder,
  updateOrder,
  type OrderAddress,
  type OrderDetail,
  type ShippingCarrier,
} from "../../lib/orders";
import { Badge, toneForStatus } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";

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
      <div className="muted" style={{ width: 200, flexShrink: 0, fontSize: "var(--text-sm)" }}>{label}</div>
      <div>{value || <span className="muted">—</span>}</div>
    </div>
  );
}

function AddressBlock({ a }: { a: OrderAddress | null }) {
  if (!a) return <span className="muted">—</span>;
  return (
    <div style={{ fontSize: "var(--text-sm)", lineHeight: 1.6 }}>
      {a.contactName && <div>{a.contactName}</div>}
      <div>{a.line1}</div>
      {a.line2 && <div>{a.line2}</div>}
      <div>
        {a.city}, {a.region} {a.postalCode}
      </div>
      <div>{a.country}</div>
      {a.phone && <div className="muted">{a.phone}</div>}
    </div>
  );
}

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [o, setO] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [panel, setPanel] = useState<null | "ship" | "cancel" | "refund">(null);
  const [ship, setShip] = useState<{ carrier: ShippingCarrier; trackingNumber: string; shippedAt: string }>({
    carrier: "USPS",
    trackingNumber: "",
    shippedAt: "",
  });
  const [cancelReason, setCancelReason] = useState("");
  const [refund, setRefund] = useState({ amount: "", reason: "" });
  const [note, setNote] = useState("");
  const [editShipment, setEditShipment] = useState(false);
  const [shipEdit, setShipEdit] = useState<{ carrier: string; trackingNumber: string }>({
    carrier: "",
    trackingNumber: "",
  });

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    getOrder(id!, ac.signal)
      .then((data) => {
        setO(data);
        setNote(data.internalNote ?? "");
        setShipEdit({
          carrier: data.shipping.carrier ?? "",
          trackingNumber: data.shipping.trackingNumber ?? "",
        });
        if (data.shipping.carrier) setShip((s) => ({ ...s, carrier: data.shipping.carrier! }));
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        setError(e instanceof ApiError ? e.message : "Failed to load order");
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [id]);

  async function refresh() {
    setO(await getOrder(id!));
  }

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
      setPanel(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;
  if (!o) return <p className="muted">{error ?? "Not found"}</p>;

  const isTerminal = o.status === "CANCELLED" || o.status === "REFUNDED";
  const canProcess = o.status === "PAID";
  const canShip = o.status === "PAID" || o.status === "PROCESSING";
  const canDeliver = o.status === "SHIPPED";
  const canCancel = o.status === "PAID" || o.status === "PROCESSING";
  const canRefund = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"].includes(o.status);
  const cur = o.currency;

  return (
    <div className="stack">
      <div className="toolbar">
        <div>
          <button className="chip" onClick={() => navigate("/orders")}>
            ← Orders
          </button>
          <h1 className="page-title" style={{ marginTop: "var(--space-2)" }}>{o.orderNumber}</h1>
          <div className="row" style={{ marginTop: "var(--space-1)" }}>
            <Badge tone={toneForStatus(o.status)}>{ORDER_STATUS_LABELS[o.status]}</Badge>
            <span className="muted" style={{ fontSize: "var(--text-xs)" }}>
              {o.customer.type === "WHOLESALE" ? "Wholesale" : "Retail"} · placed{" "}
              {new Date(o.createdAt).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="card">
          <div className="card__body" style={{ color: "var(--status-danger-fg)" }}>{error}</div>
        </div>
      )}

      {/* actions */}
      <div className="card">
        <div className="card__header">Actions</div>
        <div className="card__body stack">
          {isTerminal ? (
            <p className="muted">
              This order is {ORDER_STATUS_LABELS[o.status].toLowerCase()} — no further fulfilment actions.
            </p>
          ) : (
            <div className="row" style={{ flexWrap: "wrap" }}>
              {canProcess && (
                <Button onClick={() => run(() => processOrder(id!))} loading={busy}>
                  Start processing
                </Button>
              )}
              {canShip && (
                <Button onClick={() => setPanel(panel === "ship" ? null : "ship")}>Ship</Button>
              )}
              {canDeliver && (
                <Button onClick={() => run(() => deliverOrder(id!))} loading={busy}>
                  Mark delivered
                </Button>
              )}
              {canCancel && (
                <Button variant="secondary" onClick={() => setPanel(panel === "cancel" ? null : "cancel")}>
                  Cancel
                </Button>
              )}
              {canRefund && (
                <Button variant="danger" onClick={() => setPanel(panel === "refund" ? null : "refund")}>
                  Refund
                </Button>
              )}
            </div>
          )}

          {panel === "ship" && (
            <div className="form-grid" style={{ alignItems: "end" }}>
              <Field label="Carrier">
                <select
                  className="select"
                  value={ship.carrier}
                  onChange={(e) => setShip({ ...ship, carrier: e.target.value as ShippingCarrier })}
                >
                  {SHIPPING_CARRIERS.map((c) => (
                    <option key={c} value={c}>
                      {CARRIER_LABELS[c]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tracking number">
                <input
                  className="input"
                  value={ship.trackingNumber}
                  onChange={(e) => setShip({ ...ship, trackingNumber: e.target.value })}
                />
              </Field>
              <Field label="Shipped at" hint="Defaults to now">
                <input
                  className="input"
                  type="date"
                  value={ship.shippedAt}
                  onChange={(e) => setShip({ ...ship, shippedAt: e.target.value })}
                />
              </Field>
              <div className="row">
                <Button
                  onClick={() =>
                    run(() =>
                      shipOrder(id!, {
                        carrier: ship.carrier,
                        trackingNumber: ship.trackingNumber.trim(),
                        shippedAt: ship.shippedAt || null,
                      }),
                    )
                  }
                  loading={busy}
                  disabled={!ship.trackingNumber.trim()}
                >
                  Confirm shipment
                </Button>
                <Button variant="ghost" onClick={() => setPanel(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {panel === "cancel" && (
            <div className="stack">
              <Field label="Cancellation reason (required)" error={!cancelReason.trim() ? "Required" : undefined}>
                <textarea
                  className="textarea"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </Field>
              <div className="row">
                <Button
                  variant="danger"
                  loading={busy}
                  disabled={!cancelReason.trim()}
                  onClick={() => run(() => cancelOrder(id!, cancelReason.trim()))}
                >
                  Confirm cancel
                </Button>
                <Button variant="ghost" onClick={() => setPanel(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {panel === "refund" && (
            <div className="stack">
              <div className="form-grid" style={{ alignItems: "end" }}>
                <Field label={`Amount (${cur})`} hint={`Blank = full total ${formatMoney(o.amounts.total, cur)}`}>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={refund.amount}
                    onChange={(e) => setRefund({ ...refund, amount: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Refund reason (required)" error={!refund.reason.trim() ? "Required" : undefined}>
                <textarea
                  className="textarea"
                  value={refund.reason}
                  onChange={(e) => setRefund({ ...refund, reason: e.target.value })}
                />
              </Field>
              <div className="row">
                <Button
                  variant="danger"
                  loading={busy}
                  disabled={!refund.reason.trim()}
                  onClick={() =>
                    run(() =>
                      refundOrder(
                        id!,
                        refund.reason.trim(),
                        refund.amount.trim() === "" ? null : Number(refund.amount),
                      ),
                    )
                  }
                >
                  Confirm refund
                </Button>
                <Button variant="ghost" onClick={() => setPanel(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* timeline */}
      <div className="card">
        <div className="card__header">Timeline</div>
        <div className="card__body">
          {o.timeline.map((t, i) => (
            <Row
              key={i}
              label={ORDER_STATUS_LABELS[t.status as keyof typeof ORDER_STATUS_LABELS] ?? t.status}
              value={new Date(t.at).toLocaleString()}
            />
          ))}
          {o.cancellation?.reason && <Row label="Cancel reason" value={o.cancellation.reason} />}
          {o.refund && (
            <Row
              label="Refund"
              value={`${formatMoney(o.refund.amount, cur)}${o.refund.reason ? ` — ${o.refund.reason}` : ""}`}
            />
          )}
        </div>
      </div>

      {/* items */}
      <div className="card">
        <div className="card__header">Items</div>
        <div className="table-wrap" style={{ border: 0 }}>
          <table className="data">
            <thead>
              <tr>
                <th>Item</th>
                <th>SKU</th>
                <th>Qty</th>
                <th>Unit price</th>
                <th>Line total</th>
              </tr>
            </thead>
            <tbody>
              {o.items.map((it) => (
                <tr key={it.id}>
                  <td>{it.name}</td>
                  <td className="muted">{it.sku}</td>
                  <td>{it.quantity}</td>
                  <td>{formatMoney(it.unitPrice, cur)}</td>
                  <td>{formatMoney(it.lineTotal, cur)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} style={{ textAlign: "right" }} className="muted">Subtotal</td>
                <td>{formatMoney(o.amounts.subtotal, cur)}</td>
              </tr>
              <tr>
                <td colSpan={4} style={{ textAlign: "right" }} className="muted">Shipping</td>
                <td>{formatMoney(o.amounts.shippingFee, cur)}</td>
              </tr>
              <tr>
                <td colSpan={4} style={{ textAlign: "right" }} className="muted">Tax</td>
                <td>{formatMoney(o.amounts.taxAmount, cur)}</td>
              </tr>
              <tr>
                <td colSpan={4} style={{ textAlign: "right" }} className="muted">Discount</td>
                <td>−{formatMoney(o.amounts.discountAmount, cur)}</td>
              </tr>
              <tr>
                <td colSpan={4} style={{ textAlign: "right", fontWeight: 700 }}>Total</td>
                <td style={{ fontWeight: 700 }}>{formatMoney(o.amounts.total, cur)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* shipment */}
      <div className="card">
        <div className="card__header">Shipment</div>
        <div className="card__body">
          {editShipment && !isTerminal ? (
            <div className="form-grid" style={{ alignItems: "end" }}>
              <Field label="Carrier">
                <select
                  className="select"
                  value={shipEdit.carrier}
                  onChange={(e) => setShipEdit({ ...shipEdit, carrier: e.target.value })}
                >
                  <option value="">—</option>
                  {SHIPPING_CARRIERS.map((c) => (
                    <option key={c} value={c}>
                      {CARRIER_LABELS[c]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tracking number">
                <input
                  className="input"
                  value={shipEdit.trackingNumber}
                  onChange={(e) => setShipEdit({ ...shipEdit, trackingNumber: e.target.value })}
                />
              </Field>
              <div className="row">
                <Button
                  variant="secondary"
                  loading={busy}
                  onClick={() =>
                    run(() =>
                      updateOrder(id!, {
                        carrier: (shipEdit.carrier || null) as ShippingCarrier | null,
                        trackingNumber: shipEdit.trackingNumber.trim() || null,
                      }),
                    ).then(() => setEditShipment(false))
                  }
                >
                  Save
                </Button>
                <Button variant="ghost" onClick={() => setEditShipment(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Row
                label="Carrier"
                value={o.shipping.carrier ? CARRIER_LABELS[o.shipping.carrier] : null}
              />
              <Row label="Tracking number" value={o.shipping.trackingNumber} />
              <Row
                label="Shipped"
                value={o.shipping.shippedAt ? new Date(o.shipping.shippedAt).toLocaleString() : null}
              />
              <Row
                label="Delivered"
                value={o.shipping.deliveredAt ? new Date(o.shipping.deliveredAt).toLocaleString() : null}
              />
              {!isTerminal && (
                <div style={{ marginTop: "var(--space-3)" }}>
                  <Button variant="ghost" onClick={() => setEditShipment(true)}>
                    Edit carrier / tracking
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* addresses */}
      <div className="card">
        <div className="card__header">Addresses</div>
        <div className="card__body" style={{ display: "flex", gap: "var(--space-6)", flexWrap: "wrap" }}>
          <div>
            <div className="muted" style={{ fontSize: "var(--text-sm)", marginBottom: 4 }}>Shipping</div>
            <AddressBlock a={o.addresses.shipping} />
          </div>
          <div>
            <div className="muted" style={{ fontSize: "var(--text-sm)", marginBottom: 4 }}>Billing</div>
            <AddressBlock a={o.addresses.billing} />
          </div>
        </div>
      </div>

      {/* customer + payment */}
      <div className="card">
        <div className="card__header">Customer &amp; payment</div>
        <div className="card__body">
          <Row label="Name" value={o.customer.name} />
          <Row label="Email" value={o.customer.email} />
          <Row label="Phone" value={o.customer.phone} />
          <Row label="Payment" value={`${o.payment.provider}${o.payment.reference ? ` · ${o.payment.reference}` : ""}`} />
          <Row label="Paid at" value={o.payment.paidAt ? new Date(o.payment.paidAt).toLocaleString() : null} />
          <Row label="Customer note" value={o.customerNote} />
        </div>
      </div>

      {/* internal note */}
      <div className="card">
        <div className="card__header">Internal note</div>
        <div className="card__body stack">
          <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} disabled={isTerminal} />
          {!isTerminal && (
            <div>
              <Button
                variant="secondary"
                loading={busy}
                onClick={() => run(() => updateOrder(id!, { internalNote: note.trim() || null }))}
              >
                Save note
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* audit trail */}
      <div className="card">
        <div className="card__header">Audit trail</div>
        <div className="table-wrap" style={{ border: 0 }}>
          <table className="data">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>By</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {o.auditTrail.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted" style={{ textAlign: "center", padding: "var(--space-5)" }}>
                    No audit entries yet.
                  </td>
                </tr>
              )}
              {o.auditTrail.map((e) => (
                <tr key={e.id}>
                  <td className="muted">{new Date(e.at).toLocaleString()}</td>
                  <td>
                    <code style={{ fontSize: "var(--text-xs)" }}>{e.action}</code>
                  </td>
                  <td>{e.actor}</td>
                  <td className="muted">{e.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
