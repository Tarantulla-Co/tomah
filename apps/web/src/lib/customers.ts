import { apiGet } from "./api";
import type { WholesaleStatus } from "./wholesale";

export type CustomerType = "RETAIL" | "WHOLESALE";

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  RETAIL: "Retail",
  WHOLESALE: "Wholesale",
};

export interface CustomerListRow {
  id: string;
  type: CustomerType;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  companyName: string | null;
  phone: string | null;
  wholesale: {
    hasAccount: boolean;
    status: WholesaleStatus | null;
    unlocksWholesalePricing: boolean;
  };
  counts: { orders: number; quotes: number; invoices: number };
  createdAt: string;
  updatedAt: string;
}

export interface CustomerAddress {
  id: string;
  label: string | null;
  contactName: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone: string | null;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}

export interface CustomerDetail {
  id: string;
  type: CustomerType;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  companyName: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
  wholesaleAccount: {
    id: string;
    status: WholesaleStatus;
    businessName: string;
    unlocksWholesalePricing: boolean;
    reviewedAt: string | null;
    reviewedBy: { id: string; name: string } | null;
  } | null;
  stats: {
    orders: number;
    quotes: number;
    invoices: number;
    openQuotes: number;
    unpaidInvoices: number;
    lifetimeSpend: string;
    refundedTotal: string;
    refundedOrders: number;
  };
  addresses: CustomerAddress[];
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    total: string | null;
    currency: string;
    placedAt: string;
    carrier: string | null;
    trackingNumber: string | null;
  }>;
  recentQuotes: Array<{
    id: string;
    quoteNumber: string;
    status: string;
    total: string | null;
    currency: string;
    createdAt: string;
    validUntil: string | null;
  }>;
  recentInvoices: Array<{
    id: string;
    invoiceNumber: string;
    status: string;
    total: string | null;
    currency: string;
    issueDate: string;
    dueDate: string | null;
  }>;
}

export interface CustomerListResponse {
  data: CustomerListRow[];
  pagination: { page: number; pageSize: number; total: number; pageCount: number };
  typeCounts: Record<CustomerType, number>;
}

function qs(params: object): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params) as [string, unknown][]) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export interface CustomerListParams {
  q?: string;
  type?: "retail" | "wholesale";
  page?: number;
  sort?: string;
}

export const listCustomers = (params: CustomerListParams, signal?: AbortSignal) =>
  apiGet<CustomerListResponse>(`/customers${qs(params)}`, signal);

export const getCustomer = (id: string, signal?: AbortSignal) =>
  apiGet<{ data: CustomerDetail }>(`/customers/${id}`, signal).then((r) => r.data);
