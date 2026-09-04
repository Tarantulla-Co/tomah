import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/products";
import {
  QUOTE_STATUS_LABELS,
  addQuoteLine,
  approveQuote,
  convertQuote,
  deleteQuoteLine,
  getQuote,
  rejectQuote,
  sendQuote,
  updateQuote,
  updateQuoteLine,
  type QuoteDetail,
  type QuoteLineItem,
} from "../../lib/quotes";
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

export function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [q, setQ] = useState<QuoteDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // new line draft
  const [nd, setNd] = useState({ description: "", quantity: "1", unitPrice: "", notes: "" });
  // per-line edit buffer
  const [editing, setEditing] = useState<string | null>(null);
  const [eb, setEb] = useState({ description: "", quantity: "1", unitPrice: "", notes: "" });
  // terms buffer
  const [terms, setTerms] = useState({ validUntil: "", taxAmount: "", discountAmount: "" });

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    getQuote(id!, ac.signal)
      .then((data) => {
        setQ(data);
        setTerms({
          validUntil: data.validUntil ? data.validUntil.slice(0, 10) : "",
          taxAmount: data.taxAmount ?? "",
          discountAmount: data.discountAmount ?? "",
        });
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        setError(e instanceof ApiError ? e.message : "Failed to load quote");
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [id]);

  async function refresh() {
    const data = await getQuote(id!);
    setQ(data);
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
  if (!q) return <p className="muted">{error ?? "Not found"}</p>;

  const editable = q.status === "REQUESTED" || q.status === "DRAFT";
  const unpriced = q.lineItems.filter((li) => li.unitPrice == null).length;
  const canSend = editable && q.lineItems.length > 0 && unpriced === 0;

  function startEdit(li: QuoteLineItem) {
    setEditing(li.id);
    setEb({
      description: li.description,
      quantity: String(li.quantity),
      unitPrice: li.unitPrice ?? "",
      notes: li.notes ?? "",
    });
  }

  async function saveEdit(lineId: string) {
    await run(() =>
      updateQuoteLine(id!, lineId, {
        description: eb.description.trim(),
        quantity: Math.max(1, Number(eb.quantity) || 1),
        unitPrice: eb.unitPrice.trim() === "" ? null : Number(eb.unitPrice),
        notes: eb.notes.trim() || null,
      }),
    );
    setEditing(null);
  }

  async function addLine() {
    if (!nd.description.trim()) return;
    await run(() =>
      addQuoteLine(id!, {
        description: nd.description.trim(),
        quantity: Math.max(1, Number(nd.quantity) || 1),
        unitPrice: nd.unitPrice.trim() === "" ? null : Number(nd.unitPrice),
        notes: nd.notes.trim() || null,
      }),
    );
    setNd({ description: "", quantity: "1", unitPrice: "", notes: "" });
  }

  async function saveTerms() {
    await run(() =>
      updateQuote(id!, {
        validUntil: terms.validUntil || null,
        taxAmount: terms.taxAmount.trim() === "" ? null : Number(terms.taxAmount),
        discountAmount: terms.discountAmount.trim() === "" ? null : Number(terms.discountAmount),
      }),
    );
  }

  const cur = q.currency;

  return (
    <div className="stack">
      <div className="toolbar">
        <div>
          <button className="chip" onClick={() => navigate("/quotes")}>
            ← Quotes
          </button>
          <h1 className="page-title" style={{ marginTop: "var(--space-2)" }}>{q.quoteNumber}</h1>
          <div className="row" style={{ marginTop: "var(--space-1)" }}>
            <Badge tone={toneForStatus(q.isExpired ? "EXPIRED" : q.status)}>
              {q.isExpired ? "Expired" : QUOTE_STATUS_LABELS[q.status]}
            </Badge>
            {!q.customer.wholesaleApproved && (
              <span className="muted" style={{ fontSize: "var(--text-xs)", color: "var(--status-danger-fg)" }}>
                customer has no approved wholesale account
              </span>
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
            {editable && (
              <Button
                onClick={() => run(() => sendQuote(id!, { validUntil: terms.validUntil || null }))}
                loading={busy}
                disabled={!canSend}
              >
                Send to customer
              </Button>
            )}
            {q.status === "SENT" && (
              <Button onClick={() => run(() => approveQuote(id!))} loading={busy}>
                Record approval
              </Button>
            )}
            {q.status === "APPROVED" && (
              <Button
                onClick={() =>
                  run(async () => {
                    const r = await convertQuote(id!);
                    navigate(`/invoices/${r.invoice.id}`);
                  })
                }
                loading={busy}
              >
                Convert to invoice
              </Button>
            )}
            {["REQUESTED", "DRAFT", "SENT", "APPROVED"].includes(q.status) &&
              (showReject ? (
                <>
                  <Button
                    variant="danger"
                    loading={busy}
                    disabled={!rejectReason.trim()}
                    onClick={async () => {
                      await run(() => rejectQuote(id!, rejectReason.trim()));
                      setShowReject(false);
                      setRejectReason("");
                    }}
                  >
                    Confirm reject
                  </Button>
                  <Button variant="ghost" onClick={() => setShowReject(false)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button variant="secondary" onClick={() => setShowReject(true)}>
                  Reject
                </Button>
              ))}
            {q.invoice && (
              <Button variant="secondary" onClick={() => navigate(`/invoices/${q.invoice!.id}`)}>
                View invoice {q.invoice.invoiceNumber}
              </Button>
            )}
          </div>

          {editable && unpriced > 0 && (
            <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
              {unpriced} line{unpriced === 1 ? "" : "s"} still need a unit price before this quote can be sent.
            </p>
          )}
          {showReject && (
            <Field label="Rejection reason (required)" error={!rejectReason.trim() ? "Required" : undefined}>
              <textarea
                className="textarea"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </Field>
          )}
          {q.rejectionReason && (
            <p className="muted">
              Rejected{q.rejectedAt ? ` on ${new Date(q.rejectedAt).toLocaleString()}` : ""}: <em>{q.rejectionReason}</em>
            </p>
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
              {q.lineItems.length === 0 && (
                <tr>
                  <td colSpan={editable ? 5 : 4} className="muted" style={{ textAlign: "center", padding: "var(--space-5)" }}>
                    No line items yet.
                  </td>
                </tr>
              )}
              {q.lineItems.map((li) =>
                editing === li.id ? (
                  <tr key={li.id}>
                    <td>
                      <input
                        className="input"
                        value={eb.description}
                        onChange={(e) => setEb({ ...eb, description: e.target.value })}
                      />
                      <input
                        className="input"
                        style={{ marginTop: 4 }}
                        placeholder="Notes"
                        value={eb.notes}
                        onChange={(e) => setEb({ ...eb, notes: e.target.value })}
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
                    <td>
                      <div>{li.description}</div>
                      {li.notes && (
                        <div className="muted" style={{ fontSize: "var(--text-xs)" }}>{li.notes}</div>
                      )}
                    </td>
                    <td>{li.quantity}</td>
                    <td>
                      {li.unitPrice == null ? (
                        <span className="muted">unpriced</span>
                      ) : (
                        formatMoney(li.unitPrice, cur)
                      )}
                    </td>
                    <td>{li.lineTotal == null ? "—" : formatMoney(li.lineTotal, cur)}</td>
                    {editable && (
                      <td style={{ whiteSpace: "nowrap" }}>
                        <Button variant="ghost" onClick={() => startEdit(li)}>
                          Edit
                        </Button>
                        <Button variant="ghost" onClick={() => run(() => deleteQuoteLine(id!, li.id))}>
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
                <td>{q.subtotal ? formatMoney(q.subtotal, cur) : "—"}</td>
              </tr>
              <tr>
                <td colSpan={editable ? 4 : 3} style={{ textAlign: "right" }} className="muted">
                  Tax
                </td>
                <td>{formatMoney(q.taxAmount ?? "0", cur)}</td>
              </tr>
              <tr>
                <td colSpan={editable ? 4 : 3} style={{ textAlign: "right" }} className="muted">
                  Discount
                </td>
                <td>−{formatMoney(q.discountAmount ?? "0", cur)}</td>
              </tr>
              <tr>
                <td colSpan={editable ? 4 : 3} style={{ textAlign: "right", fontWeight: 700 }}>
                  Total
                </td>
                <td style={{ fontWeight: 700 }}>{q.total ? formatMoney(q.total, cur) : "—"}</td>
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
              <Field label={`Unit price (${cur})`} hint="Blank = price later">
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={nd.unitPrice}
                  onChange={(e) => setNd({ ...nd, unitPrice: e.target.value })}
                />
              </Field>
              <Field label="Notes" className="col-span-2">
                <input className="input" value={nd.notes} onChange={(e) => setNd({ ...nd, notes: e.target.value })} />
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
              <Field label="Valid until">
                <input
                  className="input"
                  type="date"
                  value={terms.validUntil}
                  onChange={(e) => setTerms({ ...terms, validUntil: e.target.value })}
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
              <Row label="Valid until" value={q.validUntil ? new Date(q.validUntil).toLocaleDateString() : null} />
              <Row label="Sent" value={q.sentAt ? new Date(q.sentAt).toLocaleString() : null} />
              <Row label="Approved" value={q.approvedAt ? new Date(q.approvedAt).toLocaleString() : null} />
            </>
          )}
          <Row label="Request note" value={q.requestNote} />
          <Row label="Internal note" value={q.internalNote} />
          <Row label="Created by" value={q.createdBy?.name} />
        </div>
      </div>

      {/* customer */}
      <div className="card">
        <div className="card__header">Customer</div>
        <div className="card__body">
          <Row label="Name" value={q.customer.name} />
          <Row label="Company" value={q.customer.companyName} />
          <Row label="Email" value={q.customer.email} />
          <Row label="Phone" value={q.customer.phone} />
          <Row
            label="Wholesale account"
            value={q.customer.wholesaleApproved ? "Approved" : "Not approved"}
          />
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
              {q.auditTrail.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted" style={{ textAlign: "center", padding: "var(--space-5)" }}>
                    No audit entries yet.
                  </td>
                </tr>
              )}
              {q.auditTrail.map((e) => (
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
