import { apiDelete, apiGet, apiPatch, apiPost } from "./api";

export type QuoteStatus =
  | "REQUESTED"
  | "DRAFT"
  | "SENT"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED"
  | "CONVERTED";

export const QUOTE_STATUSES: QuoteStatus[] = [
  "REQUESTED",
  "DRAFT",
  "SENT",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "CONVERTED",
];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  REQUESTED: "Requested",
  DRAFT: "Draft",
  SENT: "Sent",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  CONVERTED: "Converted",
};

export interface QuoteLineItem {
  id: string;
  productId: string | null;
  variantId: string | null;
  description: string;
  quantity: number;
  unitPrice: string | null;
  lineTotal: string | null;
  notes: string | null;
  position: number;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  status: QuoteStatus;
  isExpired: boolean;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    companyName: string | null;
    wholesaleApproved: boolean;
  };
  createdBy: { id: string; name: string } | null;
  requestNote: string | null;
  internalNote: string | null;
  currency: string;
  subtotal: string | null;
  taxAmount: string | null;
  discountAmount: string | null;
  total: string | null;
  validUntil: string | null;
  sentAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  lineItems: QuoteLineItem[];
  invoice: { id: string; invoiceNumber: string; status: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteDetail extends Quote {
  auditTrail: Array<{
    id: string;
    action: string;
    summary: string | null;
    actor: string;
    at: string;
    metadata: unknown;
  }>;
}

export interface QuoteListResponse {
  data: Quote[];
  pagination: { page: number; pageSize: number; total: number; pageCount: number };
  statusCounts: Record<QuoteStatus, number>;
}

function qs(params: object): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params) as [string, unknown][]) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export interface QuoteListParams {
  q?: string;
  status?: QuoteStatus;
  page?: number;
}

export const listQuotes = (params: QuoteListParams, signal?: AbortSignal) =>
  apiGet<QuoteListResponse>(`/quotes${qs(params)}`, signal);

export const getQuote = (id: string, signal?: AbortSignal) =>
  apiGet<{ data: QuoteDetail }>(`/quotes/${id}`, signal).then((r) => r.data);

export interface QuoteLinePayload {
  productId?: string | null;
  variantId?: string | null;
  description: string;
  quantity: number;
  unitPrice?: number | null;
  notes?: string | null;
  position?: number;
}

export interface CreateQuotePayload {
  customer: {
    customerId?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string | null;
  };
  requestNote?: string | null;
  internalNote?: string | null;
  currency?: string;
  validUntil?: string | null;
  taxAmount?: number | null;
  discountAmount?: number | null;
  lineItems: QuoteLinePayload[];
}

export const createQuote = (body: CreateQuotePayload) =>
  apiPost<{ data: Quote }>("/quotes", body).then((r) => r.data);

export const updateQuote = (
  id: string,
  body: Partial<{
    requestNote: string | null;
    internalNote: string | null;
    currency: string;
    validUntil: string | null;
    taxAmount: number | null;
    discountAmount: number | null;
  }>,
) => apiPatch<{ data: Quote }>(`/quotes/${id}`, body).then((r) => r.data);

export const addQuoteLine = (id: string, body: QuoteLinePayload) =>
  apiPost<{ data: Quote }>(`/quotes/${id}/line-items`, body).then((r) => r.data);

export const updateQuoteLine = (id: string, lineId: string, body: Partial<QuoteLinePayload>) =>
  apiPatch<{ data: Quote }>(`/quotes/${id}/line-items/${lineId}`, body).then((r) => r.data);

export const deleteQuoteLine = (id: string, lineId: string) =>
  apiDelete<{ data: Quote }>(`/quotes/${id}/line-items/${lineId}`).then((r) => r.data);

export const sendQuote = (id: string, body: { validUntil?: string | null } = {}) =>
  apiPost<{ data: Quote }>(`/quotes/${id}/send`, body).then((r) => r.data);

export const approveQuote = (id: string, note?: string) =>
  apiPost<{ data: Quote }>(`/quotes/${id}/approve`, { note }).then((r) => r.data);

export const rejectQuote = (id: string, rejectionReason: string) =>
  apiPost<{ data: Quote }>(`/quotes/${id}/reject`, { rejectionReason }).then((r) => r.data);

export interface ConvertResult {
  quote: Quote;
  invoice: { id: string; invoiceNumber: string; status: string; total: string | null; currency: string };
}

export const convertQuote = (
  id: string,
  body: { dueDate?: string | null; notes?: string | null } = {},
) => apiPost<{ data: ConvertResult }>(`/quotes/${id}/convert`, body).then((r) => r.data);
