import { useState } from "react";
import { ApiError } from "../../lib/api";
import {
  runAccountingSync,
  updateAccounting,
  type AccountingSettings,
  type AccountingSyncResult,
} from "../../lib/settings";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";

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

const STATUS_TONE = { success: "success", partial: "pending", failed: "danger" } as const;

export function AccountingTab({ value, onSaved }: { value: AccountingSettings; onSaved: () => void }) {
  const [autoSync, setAutoSync] = useState(value.autoSyncOnPayment);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AccountingSyncResult | null>(null);

  async function toggleAuto(next: boolean) {
    setAutoSync(next);
    setError(null);
    try {
      await updateAccounting({ autoSyncOnPayment: next });
      onSaved();
    } catch (e) {
      setAutoSync(!next);
      setError(e instanceof ApiError ? e.message : "Save failed");
    }
  }

  async function sync() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await runAccountingSync());
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="card__header">Accounting sync</div>
      <div className="card__body stack">
        {error && <div style={{ color: "var(--status-danger-fg)" }}>{error}</div>}

        <Row label="Adapter" value={value.adapter} />
        <Row
          label="Connection"
          value={
            <Badge tone={value.connected ? "success" : "pending"}>
              {value.connected ? "Connected" : "Not configured"}
            </Badge>
          }
        />
        <Row
          label="Last sync"
          value={
            value.lastSyncAt ? (
              <>
                {new Date(value.lastSyncAt).toLocaleString()}{" "}
                {value.lastSyncStatus && (
                  <Badge tone={STATUS_TONE[value.lastSyncStatus]}>{value.lastSyncStatus}</Badge>
                )}
                {value.lastSyncSummary && (
                  <div className="muted" style={{ fontSize: "var(--text-xs)" }}>{value.lastSyncSummary}</div>
                )}
              </>
            ) : (
              "Never"
            )
          }
        />

        {!value.connected && (
          <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
            No accounting adapter is configured (`ACCOUNTING_ADAPTER=noop`). Running a sync records
            the attempt but pushes nothing; paid invoices stay <code>NOT_SYNCED</code>. A real
            adapter (QuickBooks / Xero / Zoho) is wired via env with no code change.
          </p>
        )}

        <label className="switch-row">
          <input type="checkbox" checked={autoSync} onChange={(e) => toggleAuto(e.target.checked)} />
          Automatically push each invoice when it is paid
        </label>

        <div>
          <Button onClick={sync} loading={busy}>
            Run sync now
          </Button>
        </div>

        {result && (
          <div className="card">
            <div className="card__body stack">
              <div>
                {result.ran ? (
                  <>
                    <strong>{result.synced}</strong> synced, <strong>{result.failed}</strong> failed
                    {" "}(adapter: {result.adapter})
                  </>
                ) : (
                  <span className="muted">{result.reason}</span>
                )}
              </div>
              {result.results && result.results.length > 0 && (
                <div className="table-wrap" style={{ border: 0 }}>
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Invoice</th>
                        <th>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.results.map((r) => (
                        <tr key={r.invoiceNumber}>
                          <td>{r.invoiceNumber}</td>
                          <td>
                            {r.ok ? (
                              <Badge tone="success">synced</Badge>
                            ) : (
                              <span style={{ color: "var(--status-danger-fg)" }}>{r.error ?? "failed"}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
