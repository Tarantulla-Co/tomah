import { apiGet } from "./api";

export interface ReportSummary {
  range: { from: string; to: string };
  revenue: {
    retailOrders: string;
    wholesaleOrders: string;
    wholesaleInvoices: string;
    total: string;
  };
  byChannel: { retail: string; wholesale: string };
  orders: { count: number; avgOrderValue: string };
  refunds: { count: number; total: string };
  invoices: {
    paid: number;
    paidTotal: string;
    outstanding: number;
    outstandingTotal: string;
  };
  quotes: { sent: number; approved: number; converted: number; conversionRate: number };
  series: Array<{ period: string; retail: string; wholesale: string; total: string }>;
}

export interface TopProducts {
  range: { from: string; to: string };
  products: Array<{
    productId: string | null;
    sku: string;
    name: string;
    unitsSold: number;
    revenue: string;
  }>;
}

function qs(params: object): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params) as [string, unknown][]) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export interface ReportRange {
  from?: string;
  to?: string;
}

export const getReportSummary = (range: ReportRange, signal?: AbortSignal) =>
  apiGet<{ data: ReportSummary }>(`/reports/summary${qs(range)}`, signal).then((r) => r.data);

export const getTopProducts = (range: ReportRange & { limit?: number }, signal?: AbortSignal) =>
  apiGet<{ data: TopProducts }>(`/reports/top-products${qs(range)}`, signal).then((r) => r.data);
