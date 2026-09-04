import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../../lib/api";
import {
  WHOLESALE_STATUS_LABELS,
  listWholesaleAccounts,
  type WholesaleListResponse,
  type WholesaleStatus,
} from "../../lib/wholesale";
import { Badge, toneForStatus } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";

const STATUSES: WholesaleStatus[] = ["PENDING", "APPROVED", "REJECTED"];

export function WholesaleAccountsListPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = (params.get("status") as WholesaleStatus | null) ?? null;
  const page = Number(params.get("page") ?? "1");
  const [search, setSearch] = useState(params.get("q") ?? "");

  const [resp, setResp] = useState<WholesaleListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (search) next.set("q", search);
        else next.delete("q");
        next.delete("page");
        return next;
      });
    }, 350);
    return () => clearTimeout(t);
  }, [search, setParams]);

  const query = useMemo(
    () => ({ q: params.get("q") ?? undefined, status: status ?? undefined, page }),
    [params, status, page],
  );

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    listWholesaleAccounts(query, ac.signal)
      .then((r) => {
        setResp(r);
        setError(null);
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        setError(e instanceof ApiError ? e.message : "Failed to load applications");
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [query]);

  function setStatus(s: WholesaleStatus | null) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (s) next.set("status", s);
      else next.delete("status");
      next.delete("page");
      return next;
    });
  }

  const counts = resp?.statusCounts;

  return (
    <div className="stack">
      <div className="toolbar">
        <div>
          <h1 className="page-title">Wholesale Accounts</h1>
          <p className="muted">
            Application queue — approve or reject. Approved accounts unlock wholesale pricing.
          </p>
        </div>
        <Button onClick={() => navigate("/wholesale-accounts/new")}>Log application</Button>
      </div>

      <input
        className="input"
        style={{ maxWidth: 360 }}
        placeholder="Search business, contact or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="filter-row">
        <button className="chip" aria-pressed={!status} onClick={() => setStatus(null)}>
          All
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            className="chip"
            aria-pressed={status === s}
            onClick={() => setStatus(status === s ? null : s)}
          >
            {WHOLESALE_STATUS_LABELS[s]}
            {counts && <span className="pill-count">{counts[s] ?? 0}</span>}
          </button>
        ))}
      </div>

      {error && (
        <div className="card">
          <div className="card__body" style={{ color: "var(--status-danger-fg)" }}>{error}</div>
        </div>
      )}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Business</th>
              <th>Contact</th>
              <th>Submitted</th>
              <th>Reviewed by</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && !resp && (
              <tr>
                <td colSpan={5} className="muted" style={{ textAlign: "center", padding: "var(--space-6)" }}>
                  Loading…
                </td>
              </tr>
            )}
            {resp?.data.length === 0 && (
              <tr>
                <td colSpan={5} className="muted" style={{ textAlign: "center", padding: "var(--space-6)" }}>
                  No applications match these filters.
                </td>
              </tr>
            )}
            {resp?.data.map((a) => (
              <tr key={a.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/wholesale-accounts/${a.id}`)}>
                <td>
                  <div style={{ fontWeight: 600 }}>{a.application.businessName}</div>
                  <div className="muted" style={{ fontSize: "var(--text-xs)" }}>
                    {a.application.businessType ?? "—"}
                  </div>
                </td>
                <td>
                  <div>{a.application.contactName}</div>
                  <div className="muted" style={{ fontSize: "var(--text-xs)" }}>{a.application.contactEmail}</div>
                </td>
                <td className="muted">{new Date(a.createdAt).toLocaleDateString()}</td>
                <td className="muted">
                  {a.review.reviewedBy?.name ?? "—"}
                  {a.review.reviewedAt && (
                    <div style={{ fontSize: "var(--text-xs)" }}>
                      {new Date(a.review.reviewedAt).toLocaleDateString()}
                    </div>
                  )}
                </td>
                <td>
                  <Badge tone={toneForStatus(a.status)}>{WHOLESALE_STATUS_LABELS[a.status]}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resp && resp.pagination.pageCount > 1 && (
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <Button
            variant="secondary"
            disabled={page <= 1}
            onClick={() =>
              setParams((p) => {
                const n = new URLSearchParams(p);
                n.set("page", String(page - 1));
                return n;
              })
            }
          >
            Previous
          </Button>
          <span className="muted">
            Page {resp.pagination.page} of {resp.pagination.pageCount}
          </span>
          <Button
            variant="secondary"
            disabled={page >= resp.pagination.pageCount}
            onClick={() =>
              setParams((p) => {
                const n = new URLSearchParams(p);
                n.set("page", String(page + 1));
                return n;
              })
            }
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
