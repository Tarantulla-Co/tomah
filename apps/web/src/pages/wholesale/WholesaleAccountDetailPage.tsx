import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../../lib/api";
import {
  WHOLESALE_STATUS_LABELS,
  approveWholesaleAccount,
  getWholesaleAccount,
  rejectWholesaleAccount,
  type WholesaleAccountDetail,
} from "../../lib/wholesale";
import { Badge, toneForStatus } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: "var(--space-4)", padding: "6px 0", borderBottom: "1px solid var(--color-border)" }}>
      <div className="muted" style={{ width: 200, flexShrink: 0, fontSize: "var(--text-sm)" }}>{label}</div>
      <div>{value || <span className="muted">—</span>}</div>
    </div>
  );
}

export function WholesaleAccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [acc, setAcc] = useState<WholesaleAccountDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [reviewNotes, setReviewNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    getWholesaleAccount(id!, ac.signal)
      .then(setAcc)
      .catch((e) => {
        if (e.name === "AbortError") return;
        setError(e instanceof ApiError ? e.message : "Failed to load");
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [id]);

  async function refresh() {
    setAcc(await getWholesaleAccount(id!));
  }

  async function doApprove() {
    setBusy(true);
    setError(null);
    try {
      await approveWholesaleAccount(id!, reviewNotes.trim() || undefined);
      setReviewNotes("");
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Approve failed");
    } finally {
      setBusy(false);
    }
  }

  async function doReject() {
    if (!rejectReason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await rejectWholesaleAccount(id!, rejectReason.trim(), reviewNotes.trim() || undefined);
      setRejectReason("");
      setReviewNotes("");
      setShowReject(false);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Reject failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;
  if (!acc) return <p className="muted">{error ?? "Not found"}</p>;

  const a = acc.application;
  const canApprove = acc.status !== "APPROVED";
  const canReject = acc.status !== "REJECTED";

  return (
    <div className="stack">
      <div className="toolbar">
        <div>
          <button className="chip" onClick={() => navigate("/wholesale-accounts")}>
            ← Wholesale Accounts
          </button>
          <h1 className="page-title" style={{ marginTop: "var(--space-2)" }}>{a.businessName}</h1>
          <div className="row" style={{ marginTop: "var(--space-1)" }}>
            <Badge tone={toneForStatus(acc.status)}>{WHOLESALE_STATUS_LABELS[acc.status]}</Badge>
            {acc.unlocksWholesalePricing && (
              <span className="muted" style={{ fontSize: "var(--text-xs)" }}>
                wholesale pricing unlocked for this customer
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

      {/* review actions */}
      <div className="card">
        <div className="card__header">Review</div>
        <div className="card__body stack">
          {acc.review.reviewedBy ? (
            <p className="muted">
              Last reviewed by <strong>{acc.review.reviewedBy.name}</strong> on{" "}
              {acc.review.reviewedAt && new Date(acc.review.reviewedAt).toLocaleString()}
              {acc.review.rejectionReason && (
                <>
                  {" "}
                  · reason: <em>{acc.review.rejectionReason}</em>
                </>
              )}
            </p>
          ) : (
            <p className="muted">Not yet reviewed.</p>
          )}

          <Field label="Review notes (optional)" hint="Stored on the account and in the audit log">
            <textarea
              className="textarea"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
            />
          </Field>

          {showReject && (
            <Field label="Rejection reason (required)" error={!rejectReason.trim() ? "Required" : undefined}>
              <textarea
                className="textarea"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </Field>
          )}

          <div className="row">
            {canApprove && (
              <Button onClick={doApprove} loading={busy}>
                {acc.status === "REJECTED" ? "Approve instead" : "Approve"}
              </Button>
            )}
            {canReject &&
              (showReject ? (
                <>
                  <Button variant="danger" onClick={doReject} loading={busy} disabled={!rejectReason.trim()}>
                    Confirm {acc.status === "APPROVED" ? "revoke" : "reject"}
                  </Button>
                  <Button variant="ghost" onClick={() => setShowReject(false)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button variant="secondary" onClick={() => setShowReject(true)}>
                  {acc.status === "APPROVED" ? "Revoke access" : "Reject"}
                </Button>
              ))}
          </div>
        </div>
      </div>

      {/* application details */}
      <div className="card">
        <div className="card__header">Application</div>
        <div className="card__body">
          <Row label="Business name" value={a.businessName} />
          <Row label="Business type" value={a.businessType} />
          <Row label="Website" value={a.website} />
          <Row label="Registration number" value={a.businessRegistrationNumber} />
          <Row label="Tax ID" value={a.taxId} />
          <Row label="Est. monthly volume" value={a.estimatedMonthlyVolume} />
          <Row label="Contact" value={`${a.contactName} · ${a.contactEmail}${a.contactPhone ? " · " + a.contactPhone : ""}`} />
          <Row label="Notes" value={a.applicationNotes} />
        </div>
      </div>

      {/* customer */}
      <div className="card">
        <div className="card__header">Customer</div>
        <div className="card__body">
          <Row label="Name" value={acc.customer.name} />
          <Row label="Email" value={acc.customer.email} />
          <Row label="Phone" value={acc.customer.phone} />
          <Row label="Type" value={acc.customer.type} />
          <Row
            label="Activity"
            value={`${acc.customerActivity.orders} orders · ${acc.customerActivity.quotes} quotes`}
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
              {acc.auditTrail.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted" style={{ textAlign: "center", padding: "var(--space-5)" }}>
                    No audit entries yet.
                  </td>
                </tr>
              )}
              {acc.auditTrail.map((e) => (
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
