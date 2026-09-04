import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../../lib/api";
import { createQuote, type CreateQuotePayload, type QuoteLinePayload } from "../../lib/quotes";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";

interface DraftLine {
  description: string;
  quantity: string;
  unitPrice: string;
  notes: string;
}

const EMPTY_LINE: DraftLine = { description: "", quantity: "1", unitPrice: "", notes: "" };

export function QuoteEditorPage() {
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [validUntil, setValidUntil] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([{ ...EMPTY_LINE }]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setLine(i: number, patch: Partial<DraftLine>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((ls) => [...ls, { ...EMPTY_LINE }]);
  }
  function removeLine(i: number) {
    setLines((ls) => (ls.length === 1 ? ls : ls.filter((_, idx) => idx !== i)));
  }

  const filledLines = lines.filter((l) => l.description.trim());
  const valid = firstName && lastName && email && filledLines.length > 0;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const lineItems: QuoteLinePayload[] = filledLines.map((l) => ({
        description: l.description.trim(),
        quantity: Math.max(1, Number(l.quantity) || 1),
        unitPrice: l.unitPrice.trim() === "" ? null : Number(l.unitPrice),
        notes: l.notes.trim() || null,
      }));
      const payload: CreateQuotePayload = {
        customer: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
        },
        currency: currency.trim().toUpperCase() || "USD",
        validUntil: validUntil || null,
        requestNote: requestNote.trim() || null,
        internalNote: internalNote.trim() || null,
        taxAmount: taxAmount.trim() === "" ? null : Number(taxAmount),
        discountAmount: discountAmount.trim() === "" ? null : Number(discountAmount),
        lineItems,
      };
      const created = await createQuote(payload);
      navigate(`/quotes/${created.id}`, { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create the quote");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="toolbar">
        <div>
          <button className="chip" onClick={() => navigate("/quotes")}>
            ← Quotes
          </button>
          <h1 className="page-title" style={{ marginTop: "var(--space-2)" }}>New quote</h1>
          <p className="muted">
            Links or creates a wholesale customer by email and starts the quote as <strong>Draft</strong>.
            Leave a unit price blank to price it later.
          </p>
        </div>
      </div>

      {error && (
        <div className="card">
          <div className="card__body" style={{ color: "var(--status-danger-fg)" }}>{error}</div>
        </div>
      )}

      <div className="card">
        <div className="card__header">Customer</div>
        <div className="card__body">
          <div className="form-grid">
            <Field label="First name">
              <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </Field>
            <Field label="Last name">
              <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </Field>
            <Field label="Email" hint="An existing customer with this email is linked instead of duplicated">
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Phone">
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__header">Line items</div>
        <div className="card__body stack">
          {lines.map((l, i) => (
            <div key={i} className="form-grid" style={{ alignItems: "end" }}>
              <Field label="Description" className="col-span-2">
                <input
                  className="input"
                  value={l.description}
                  onChange={(e) => setLine(i, { description: e.target.value })}
                />
              </Field>
              <Field label="Quantity">
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={l.quantity}
                  onChange={(e) => setLine(i, { quantity: e.target.value })}
                />
              </Field>
              <Field label={`Unit price (${currency})`} hint="Blank = price later">
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={l.unitPrice}
                  onChange={(e) => setLine(i, { unitPrice: e.target.value })}
                />
              </Field>
              <Field label="Notes" className="col-span-2">
                <input className="input" value={l.notes} onChange={(e) => setLine(i, { notes: e.target.value })} />
              </Field>
              <div>
                <Button variant="ghost" onClick={() => removeLine(i)} disabled={lines.length === 1}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
          <div>
            <Button variant="secondary" onClick={addLine}>
              Add line
            </Button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__header">Terms</div>
        <div className="card__body">
          <div className="form-grid">
            <Field label="Currency">
              <input className="input" value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} />
            </Field>
            <Field label="Valid until">
              <input className="input" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </Field>
            <Field label={`Tax amount (${currency})`}>
              <input
                className="input"
                type="number"
                min={0}
                step="0.01"
                value={taxAmount}
                onChange={(e) => setTaxAmount(e.target.value)}
              />
            </Field>
            <Field label={`Discount amount (${currency})`}>
              <input
                className="input"
                type="number"
                min={0}
                step="0.01"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
              />
            </Field>
            <Field label="Request note" className="col-span-2" hint="What the customer asked for">
              <textarea className="textarea" value={requestNote} onChange={(e) => setRequestNote(e.target.value)} />
            </Field>
            <Field label="Internal note" className="col-span-2" hint="Staff-only, not shown to the customer">
              <textarea className="textarea" value={internalNote} onChange={(e) => setInternalNote(e.target.value)} />
            </Field>
          </div>
        </div>
      </div>

      <div>
        <Button onClick={submit} loading={busy} disabled={!valid}>
          Create quote
        </Button>
      </div>
    </div>
  );
}
