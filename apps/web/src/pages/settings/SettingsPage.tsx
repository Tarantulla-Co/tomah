import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiError } from "../../lib/api";
import { getSettings, type AllSettings } from "../../lib/settings";
import { PaymentsTab } from "./PaymentsTab";
import { ShippingTab } from "./ShippingTab";
import { TaxTab } from "./TaxTab";
import { AccountingTab } from "./AccountingTab";
import { ReportsTab } from "./ReportsTab";

const TABS = [
  { key: "payments", label: "Payments" },
  { key: "shipping", label: "Shipping" },
  { key: "tax", label: "Tax" },
  { key: "accounting", label: "Accounting sync" },
  { key: "reports", label: "Reports" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as TabKey | null) ?? "payments";

  const [settings, setSettings] = useState<AllSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setSettings(await getSettings());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  function setTab(t: TabKey) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", t);
      return next;
    });
  }

  return (
    <div className="stack">
      <div className="toolbar">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="muted">
            Payment gateway, shipping &amp; tax rules, accounting sync, and revenue reporting.
            Admin only.
          </p>
        </div>
      </div>

      <div className="filter-row">
        {TABS.map((t) => (
          <button
            key={t.key}
            className="chip"
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="card">
          <div className="card__body" style={{ color: "var(--status-danger-fg)" }}>{error}</div>
        </div>
      )}

      {loading && !settings && <p className="muted">Loading…</p>}

      {settings && tab === "payments" && <PaymentsTab value={settings.payments} onSaved={load} />}
      {settings && tab === "shipping" && <ShippingTab value={settings.shipping} onSaved={load} />}
      {settings && tab === "tax" && <TaxTab value={settings.tax} onSaved={load} />}
      {settings && tab === "accounting" && <AccountingTab value={settings.accounting} onSaved={load} />}
      {tab === "reports" && <ReportsTab />}
    </div>
  );
}
