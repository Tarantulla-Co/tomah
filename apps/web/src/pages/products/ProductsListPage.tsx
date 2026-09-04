import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import {
  CATEGORY_LABELS,
  PRODUCT_CATEGORIES,
  formatMoney,
  listProducts,
  type ProductCategory,
  type ProductListResponse,
} from "../../lib/products";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";

type StatusFilter = "all" | "published" | "draft";

export function ProductsListPage() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canEdit = hasRole("CONTENT_EDITOR");

  const [params, setParams] = useSearchParams();
  const category = (params.get("category") as ProductCategory | null) ?? null;
  const status = (params.get("status") as StatusFilter | null) ?? "all";
  const page = Number(params.get("page") ?? "1");
  const [search, setSearch] = useState(params.get("q") ?? "");

  const [resp, setResp] = useState<ProductListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Debounce the search box into the URL.
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
    () => ({
      q: params.get("q") ?? undefined,
      category: category ?? undefined,
      status: status === "all" ? undefined : status,
      page,
      pageSize: 25,
    }),
    [params, category, status, page],
  );

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    listProducts(query, ac.signal)
      .then((r) => {
        setResp(r);
        setError(null);
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        setError(e instanceof ApiError ? e.message : "Failed to load products");
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [query]);

  function setFilter(key: string, value: string | null) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete("page");
      return next;
    });
  }

  const counts = resp?.categoryCounts;

  return (
    <div className="stack">
      <div className="toolbar">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="muted">
            {resp ? `${resp.pagination.total} products` : "Catalogue"} · retail &amp; wholesale pricing,
            stock, categories
          </p>
        </div>
        {canEdit && <Button onClick={() => navigate("/products/new")}>New product</Button>}
      </div>

      <input
        className="input"
        style={{ maxWidth: 360 }}
        placeholder="Search name, SKU or barcode…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* category filter chips */}
      <div className="filter-row">
        <button className="chip" aria-pressed={!category} onClick={() => setFilter("category", null)}>
          All categories
        </button>
        {PRODUCT_CATEGORIES.map((c) => (
          <button
            key={c}
            className="chip"
            aria-pressed={category === c}
            onClick={() => setFilter("category", category === c ? null : c)}
          >
            {CATEGORY_LABELS[c]}
            {counts && <span className="pill-count">{counts[c] ?? 0}</span>}
          </button>
        ))}
      </div>

      {/* status filter chips */}
      <div className="filter-row" style={{ marginTop: "calc(-1 * var(--space-2))" }}>
        {(["all", "published", "draft"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            className="chip"
            aria-pressed={status === s}
            onClick={() => setFilter("status", s === "all" ? null : s)}
          >
            {s === "all" ? "All statuses" : s === "published" ? "Published" : "Draft"}
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
              <th>Product</th>
              <th>Category</th>
              <th>Retail</th>
              <th>Wholesale / MOQ</th>
              <th>Stock</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && !resp && (
              <tr>
                <td colSpan={6} className="muted" style={{ textAlign: "center", padding: "var(--space-6)" }}>
                  Loading…
                </td>
              </tr>
            )}
            {resp?.data.length === 0 && (
              <tr>
                <td colSpan={6} className="muted" style={{ textAlign: "center", padding: "var(--space-6)" }}>
                  No products match these filters.
                </td>
              </tr>
            )}
            {resp?.data.map((p) => (
              <tr
                key={p.id}
                style={{ cursor: "pointer" }}
                onClick={() => navigate(`/products/${p.id}`)}
              >
                <td>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div className="muted" style={{ fontSize: "var(--text-xs)" }}>
                    {p.sku}
                    {p.variants.length > 0 && ` · ${p.variants.length} variant${p.variants.length > 1 ? "s" : ""}`}
                  </div>
                </td>
                <td>{CATEGORY_LABELS[p.category]}</td>
                <td>{p.isRetailAvailable ? formatMoney(p.retailPrice, p.currency) : <span className="muted">not retail</span>}</td>
                <td>
                  {p.isWholesaleAvailable ? (
                    <>
                      {formatMoney(p.wholesalePrice, p.currency)}
                      {p.minimumOrderQuantity ? (
                        <span className="muted"> · MOQ {p.minimumOrderQuantity}</span>
                      ) : null}
                    </>
                  ) : (
                    <span className="muted">not wholesale</span>
                  )}
                </td>
                <td>
                  <span style={{ fontWeight: 600 }}>{p.stock.quantity}</span>{" "}
                  {p.stock.source === "ACCOUNTING_SYNC" && (
                    <span className="muted" style={{ fontSize: "var(--text-xs)" }}>· synced</span>
                  )}
                  {!p.stock.syncEnabled && (
                    <span className="muted" style={{ fontSize: "var(--text-xs)" }}>· locked</span>
                  )}
                </td>
                <td>
                  <Badge tone={p.isPublished ? "success" : "pending"}>
                    {p.isPublished ? "Published" : "Draft"}
                  </Badge>
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
            onClick={() => setFilter("page", String(page - 1))}
          >
            Previous
          </Button>
          <span className="muted">
            Page {resp.pagination.page} of {resp.pagination.pageCount}
          </span>
          <Button
            variant="secondary"
            disabled={page >= resp.pagination.pageCount}
            onClick={() => setFilter("page", String(page + 1))}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
