import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../../lib/api";
import { createWholesaleApplication, type NewApplicationInput } from "../../lib/wholesale";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";

const EMPTY: NewApplicationInput = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  businessName: "",
  businessType: "",
  website: "",
  businessRegistrationNumber: "",
  taxId: "",
  estimatedMonthlyVolume: "",
  applicationNotes: "",
};

export function WholesaleApplicationNewPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<NewApplicationInput>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof NewApplicationInput>(k: K, v: NewApplicationInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const clean = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]),
      ) as NewApplicationInput;
      const created = await createWholesaleApplication(clean);
      navigate(`/wholesale-accounts/${created.id}`, { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create application");
    } finally {
      setBusy(false);
    }
  }

  const valid = form.firstName && form.lastName && form.email && form.businessName;

  return (
    <div className="stack">
      <div className="toolbar">
        <div>
          <button className="chip" onClick={() => navigate("/wholesale-accounts")}>
            ← Wholesale Accounts
          </button>
          <h1 className="page-title" style={{ marginTop: "var(--space-2)" }}>Log an application</h1>
          <p className="muted">
            For applications received offline. Creates or links a wholesale customer by email and
            queues it as <strong>Pending</strong>.
          </p>
        </div>
      </div>

      {error && (
        <div className="card">
          <div className="card__body" style={{ color: "var(--status-danger-fg)" }}>{error}</div>
        </div>
      )}

      <div className="card">
        <div className="card__header">Applicant</div>
        <div className="card__body">
          <div className="form-grid">
            <Field label="First name">
              <input className="input" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
            </Field>
            <Field label="Last name">
              <input className="input" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
            </Field>
            <Field label="Email">
              <input className="input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Phone">
              <input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__header">Business</div>
        <div className="card__body">
          <div className="form-grid">
            <Field label="Business name" className="col-span-2">
              <input className="input" value={form.businessName} onChange={(e) => set("businessName", e.target.value)} />
            </Field>
            <Field label="Business type" hint="Restaurant, Distributor, Grocery…">
              <input className="input" value={form.businessType} onChange={(e) => set("businessType", e.target.value)} />
            </Field>
            <Field label="Website">
              <input className="input" value={form.website} onChange={(e) => set("website", e.target.value)} />
            </Field>
            <Field label="Registration number">
              <input
                className="input"
                value={form.businessRegistrationNumber}
                onChange={(e) => set("businessRegistrationNumber", e.target.value)}
              />
            </Field>
            <Field label="Tax ID">
              <input className="input" value={form.taxId} onChange={(e) => set("taxId", e.target.value)} />
            </Field>
            <Field label="Estimated monthly volume" className="col-span-2">
              <input
                className="input"
                value={form.estimatedMonthlyVolume}
                onChange={(e) => set("estimatedMonthlyVolume", e.target.value)}
              />
            </Field>
            <Field label="Notes" className="col-span-2">
              <textarea
                className="textarea"
                value={form.applicationNotes}
                onChange={(e) => set("applicationNotes", e.target.value)}
              />
            </Field>
          </div>
        </div>
      </div>

      <div>
        <Button onClick={submit} loading={busy} disabled={!valid}>
          Create application
        </Button>
      </div>
    </div>
  );
}
