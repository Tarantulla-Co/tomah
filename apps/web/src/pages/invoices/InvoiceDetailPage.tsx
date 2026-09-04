import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/products";
import {
  INVOICE_STATUS_LABELS,
  addInvoiceLine,
  deleteInvoiceLine,
  getInvoice,
  recordPayment,
  sendInvoice,
  updateInvoice,
  updateInvoiceLine,
  voidInvoice,
  type InvoiceDetail,
  type InvoiceLineItem,
} from "../../lib/invoices";
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

const ACCOUNTING_LABELS: Record<string, string> = {
  NOT_SYNCED: "Not synced",
  PENDING: "Pending",
  SYNCED: "Synced",
  FAILED: "Failed",
};

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [inv, setInv] = useState<InvoiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [showPay, setShowPay] = useState(false);
  const [pay, setPay] = useState({ reference: "", paidAt: "", amount: "", note: "" });
  const [showVoid, setShowVoid] = useState(false);
  const [voidReason, setVoidReason] = useState("");

  const [nd, setNd] = useState({ description: "", quantity: "1", unitPrice: "" });
  const [editing, setEditing] = useState<string | null>(null);
  const [eb, setEb] = useState({ description: "", quantity: "1", unitPrice: "" });
  const [terms, setTerms] = useState({ dueDate: "", taxAmount: "", discountAmount: "" });

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    getInvoice(id!, ac.signal)
      .then((data) => {
        setInv(data);
        setTerms({
          dueDate: data.dueDate ? data.dueDate.slice(0, 10) : "",
          taxAmount: data.taxAmount ?? "",
          discountAmount: data.discountAmount ?? "",
        });
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        setError(e instanceof ApiError ? e.message : "Failed to load invoice");
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [id]);

  async function refresh() {
    setInv(await getInvoice(id!));
  }

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;
  if (!inv) return <p className="muted">{error ?? "Not found"}</p>;

  const editable = inv.status === "DRAFT";
  const canPay = ["DRAFT", "SENT", "OVERDUE"].includes(inv.status);
  const canVoid = !["PAID", "VOID"].includes(inv.status);
  const cur = inv.currency;

  function startEdit(li: InvoiceLineItem) {
    setEditing(li.id);
    setEb({ description: li.description, quantity: String(li.quantity), unitPrice: li.unitPrice });
  }

  async function saveEdit(lineId: string) {
    await run(() =>
      updateInvoiceLine(id!, lineId, {
        description: eb.description.trim(),
        quantity: Math.max(1, Number(eb.quantity) || 1),
        unitPrice: Number(eb.unitPrice) || 0,
      }),
    );
    setEditing(null);
  }

  async function addLine() {
    if (!nd.description.trim()) return;
    await run(() =>
      addInvoiceLine(id!, {
        description: nd.description.trim(),
        quantity: Math.max(1, Number(nd.quantity) || 1),
        unitPrice: Number(nd.unitPrice) || 0,
      }),
    );
    setNd({ description: "", quantity: "1", unitPrice: "" });
  }

  async function saveTerms() {
    await run(() =>
      updateInvoice(id!, {
        dueDate: terms.dueDate || null,
        taxAmount: terms.taxAmount.trim() === "" ? null : Number(terms.taxAmount),
        discountAmount: terms.discountAmount.trim() === "" ? null : Number(terms.discountAmount),
      }),
    );
  }

  async function submitPayment() {
    await run(() =>
      recordPayment(id!, {
        reference: pay.reference.trim() || undefined,
        paidAt: pay.paidAt || null,
        amount: pay.amount.trim() === "" ? null : Number(pay.amount),
        note: pay.note.trim() || null,
      }),
    );
    setShowPay(false);
    setPay({ reference: "", paidAt: "", amount: "", note: "" });
  }

  return (
    <div className="stack">
      <div className="toolbar">
        <div>
          <button className="chip" onClick={() => navigate("/invoices")}>
            ← Invoices
          </button>
          <h1 className="page-title" style={{ marginTop: "var(--space-2)" }}>{inv.invoiceNumber}</h1>
          <div className="row" style={{ marginTop: "var(--space-1)" }}>
            <Badge tone={toneForStatus(inv.isOverdue && inv.status === "SENT" ? "OVERDUE" : inv.status)}>
              {inv.isOverdue && inv.status === "SENT" ? "Overdue" : INVOICE_STATUS_LABELS[inv.status]}
            </Badge>
            {inv.quote && (
              <button className="chip" onClick={() => navigate(`/quotes/${inv.quote!.id}`)}>
                from {inv.quote.quoteNumber}
              </button>
            )}
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
          <div className="row" style={{ flexWrap: "wrap" }}>
            {inv.status === "DRAFT" && (
              <Button
                onClick={() => run(() => sendInvoice(id!, { dueDate: terms.dueDate || null }))}
                loading={busy}
                disabled={inv.lineItems.length === 0}
              >
                Send to customer
              </Button>
            )}
            {canPay && !showPay && (
              <Button onClick={() => setShowPay(true)}>Record payment</Button>
            )}
            {canVoid && !showVoid && (
              <Button variant="secondary" onClick={() => setShowVoid(true)}>
                Void
              </Button>
            )}
          </div>

          {showPay && (
            <div className="form-grid" style={{ alignItems: "end" }}>
              <Field label="Payment reference" hint="e.g. Stripe payment id or bank transfer id">
                <input
                  className="input"
                  value={pay.reference}
                  onChange={(e) => setPay({ ...pay, reference: e.target.value })}
                />
              </Field>
              <Field label="Paid at" hint="Defaults to now">
                <input
                  className="input"
                  type="date"
                  value={pay.paidAt}
                  onChange={(e) => setPay({ ...pay, paidAt: e.target.value })}
                />
              </Field>
              <Field label={`Amount (${cur})`} hint={`Invoice total ${formatMoney(inv.total, cur)}`}>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={pay.amount}
                  onChange={(e) => setPay({ ...pay, amount: e.target.value })}
                />
              </Field>
              <Field label="Note" className="col-span-2">
                <input className="input" value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} />
              </Field>
              <div className="row">
                <Button onClick={submitPayment} loading={busy}>
                  Mark paid
                </Button>
                <Button variant="ghost" onClick={() => setShowPay(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {showVoid && (
            <div className="stack">
              <Field label="Void reason (optional)">
                <input className="input" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
              </Field>
              <div className="row">
                <Button
                  variant="danger"
                  loading={busy}
                  onClick={async () => {
                    await run(() => voidInvoice(id!, voidReason.trim() || undefined));
                    setShowVoid(false);
                    setVoidReason("");
                  }}
                >
                  Confirm void
                </Button>
                <Button variant="ghost" onClick={() => setShowVoid(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* line items */}
      <div className="card">
        <div className="card__header">Line items</div>
        <div className="table-wrap" style={{ border: 0 }}>
          <table className="data">
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit price</th>
                <th>Line total</th>
                {editable && <th />}
              </tr>
            </thead>
            <tbody>
              {inv.lineItems.length === 0 && (
                <tr>
                  <td colSpan={editable ? 5 : 4} className="muted" style={{ textAlign: "center", padding: "var(--space-5)" }}>
                    No line items yet.
                  </td>
                </tr>
              )}
              {inv.lineItems.map((li) =>
                editing === li.id ? (
                  <tr key={li.id}>
                    <td>
                      <input
                        className="input"
                        value={eb.description}
                        onChange={(e) => setEb({ ...eb, description: e.target.value })}
                      />
                    </td>
                    <td style={{ width: 90 }}>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        value={eb.quantity}
                        onChange={(e) => setEb({ ...eb, quantity: e.target.value })}
                      />
                    </td>
                    <td style={{ width: 130 }}>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        step="0.01"
                        value={eb.unitPrice}
                        onChange={(e) => setEb({ ...eb, unitPrice: e.target.value })}
                      />
                    </td>
                    <td className="muted">—</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <Button variant="ghost" onClick={() => saveEdit(li.id)} loading={busy}>
                        Save
                      </Button>
                      <Button variant="ghost" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                    </td>
                  </tr>
                ) : (
                  <tr key={li.id}>
                    <td>{li.description}</td>
                    <td>{li.quantity}</td>
                    <td>{formatMoney(li.unitPrice, cur)}</td>
                    <td>{formatMoney(li.lineTotal, cur)}</td>
                    {editable && (
                      <td style={{ whiteSpace: "nowrap" }}>
                        <Button variant="ghost" onClick={() => startEdit(li)}>
                          Edit
                        </Button>
                        <Button variant="ghost" onClick={() => run(() => deleteInvoiceLine(id!, li.id))}>
                          Delete
                        </Button>
                      </td>
                    )}
                  </tr>
                ),
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={editable ? 4 : 3} style={{ textAlign: "right" }} className="muted">
                  Subtotal
                </td>
                <td>{formatMoney(inv.subtotal, cur)}</td>
              </tr>
              <tr>
                <td colSpan={editable ? 4 : 3} style={{ textAlign: "right" }} className="muted">
                  Tax
                </td>
                <td>{formatMoney(inv.taxAmount, cur)}</td>
              </tr>
              <tr>
                <td colSpan={editable ? 4 : 3} style={{ textAlign: "right" }} className="muted">
                  Discount
                </td>
                <td>−{formatMoney(inv.discountAmount, cur)}</td>
              </tr>
              <tr>
                <td colSpan={editable ? 4 : 3} style={{ textAlign: "right", fontWeight: 700 }}>
                  Total
                </td>
                <td style={{ fontWeight: 700 }}>{formatMoney(inv.total, cur)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {editable && (
          <div className="card__body stack" style={{ borderTop: "1px solid var(--color-border)" }}>
            <div className="form-grid" style={{ alignItems: "end" }}>
              <Field label="Description" className="col-span-2">
                <input
                  className="input"
                  value={nd.description}
                  onChange={(e) => setNd({ ...nd, description: e.target.value })}
                />
              </Field>
              <Field label="Qty">
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={nd.quantity}
                  onChange={(e) => setNd({ ...nd, quantity: e.target.value })}
                />
              </Field>
              <Field label={`Unit price (${cur})`}>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={nd.unitPrice}
                  onChange={(e) => setNd({ ...nd, unitPrice: e.target.value })}
                />
              </Field>
              <div>
                <Button variant="secondary" onClick={addLine} loading={busy} disabled={!nd.description.trim()}>
                  Add line
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* terms */}
      <div className="card">
        <div className="card__header">Terms</div>
        <div className="card__body">
          {editable ? (
            <div className="form-grid" style={{ alignItems: "end" }}>
              <Field label="Due date">
                <input
                  className="input"
                  type="date"
                  value={terms.dueDate}
                  onChange={(e) => setTerms({ ...terms, dueDate: e.target.value })}
                />
              </Field>
              <Field label={`Tax amount (${cur})`}>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={terms.taxAmount}
                  onChange={(e) => setTerms({ ...terms, taxAmount: e.target.value })}
                />
              </Field>
              <Field label={`Discount amount (${cur})`}>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={terms.discountAmount}
                  onChange={(e) => setTerms({ ...terms, discountAmount: e.target.value })}
                />
              </Field>
              <div>
                <Button variant="secondary" onClick={saveTerms} loading={busy}>
                  Save terms
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Row label="Issued" value={new Date(inv.issueDate).toLocaleDateString()} />
              <Row label="Due" value={inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : null} />
              <Row label="Sent" value={inv.sentAt ? new Date(inv.sentAt).toLocaleString() : null} />
            </>
          )}
          <Row label="Notes" value={inv.notes} />
        </div>
      </div>

      {/* payment */}
      <div className="card">
        <div className="card__header">Payment</div>
        <div className="card__body">
          <Row label="Provider" value={`${inv.payment.provider}${inv.payment.online ? "" : " (manual recording)"}`} />
          <Row label="Reference" value={inv.payment.reference} />
          <Row label="Paid at" value={inv.paidAt ? new Date(inv.paidAt).toLocaleString() : null} />
        </div>
      </div>

      {/* accounting sync */}
      <div className="card">
        <div className="card__header">Accounting sync</div>
        <div className="card__body">
          <Row
            label="Status"
            value={
              <Badge tone={toneForStatus(inv.accounting.status)}>
                {ACCOUNTING_LABELS[inv.accounting.status] ?? inv.accounting.status}
              </Badge>
            }
          />
          <Row label="Adapter" value={inv.accounting.adapter} />
          <Row label="External ref" value={inv.accounting.ref} />
          <Row label="Synced at" value={inv.accounting.syncedAt ? new Date(inv.accounting.syncedAt).toLocaleString() : null} />
          {inv.accounting.error && <Row label="Error" value={<span style={{ color: "var(--status-danger-fg)" }}>{inv.accounting.error}</span>} />}
          {inv.accounting.status === "NOT_SYNCED" && (
            <p className="muted" style={{ fontSize: "var(--text-sm)", marginTop: "var(--space-2)" }}>
              No accounting adapter is configured. Paid invoices push automatically once one is wired in Phase 8.
            </p>
          )}
        </div>
      </div>

      {/* customer */}
      <div className="card">
        <div className="card__header">Customer</div>
        <div className="card__body">
          <Row label="Name" value={inv.customer.name} />
          <Row label="Company" value={inv.customer.companyName} />
          <Row label="Email" value={inv.customer.email} />
          <Row label="Phone" value={inv.customer.phone} />
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
              {inv.auditTrail.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted" style={{ textAlign: "center", padding: "var(--space-5)" }}>
                    No audit entries yet.
                  </td>
                </tr>
              )}
              {inv.auditTrail.map((e) => (
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
