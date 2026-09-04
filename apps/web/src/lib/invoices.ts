import { apiDelete, apiGet, apiPatch, apiPost } from "./api";

export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "VOID";

export const INVOICE_STATUSES: InvoiceStatus[] = ["DRAFT", "SENT", "PAID", "OVERDUE", "VOID"];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PAID: "Paid",
  OVERDUE: "Overdue",
  VOID: "Void",
};

export type AccountingSyncStatus = "NOT_SYNCED" | "PENDING" | "SYNCED" | "FAILED";

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  position: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  isOverdue: boolean;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    companyName: string | null;
  };
  quote: { id: string; quoteNumber: string; status: string } | null;
  currency: string;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  total: string;
  issueDate: string;
  dueDate: string | null;
  sentAt: string | null;
  paidAt: string | null;
  payment: { provider: string; reference: string | null; online: boolean };
  accounting: {
    status: AccountingSyncStatus;
    adapter: string | null;
    ref: string | null;
    syncedAt: string | null;
    error: string | null;
  };
  notes: string | null;
  lineItems: InvoiceLineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceDetail extends Invoice {
  auditTrail: Array<{
    id: string;
    action: string;
    summary: string | null;
    actor: string;
    at: string;
    metadata: unknown;
  }>;
}

export interface InvoiceListResponse {
  data: Invoice[];
  pagination: { page: number; pageSize: number; total: number; pageCount: number };
  statusCounts: Record<InvoiceStatus, number>;
}

function qs(params: object): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params) as [string, unknown][]) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export interface InvoiceListParams {
  q?: string;
  status?: InvoiceStatus;
  page?: number;
}

export const listInvoices = (params: InvoiceListParams, signal?: AbortSignal) =>
  apiGet<InvoiceListResponse>(`/invoices${qs(params)}`, signal);

export const getInvoice = (id: string, signal?: AbortSignal) =>
  apiGet<{ data: InvoiceDetail }>(`/invoices/${id}`, signal).then((r) => r.data);

export interface InvoiceLinePayload {
  description: string;
  quantity: number;
  unitPrice: number;
  position?: number;
}

export interface CreateInvoicePayload {
  customer: {
    customerId?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string | null;
  };
  currency?: string;
  dueDate?: string | null;
  notes?: string | null;
  taxAmount?: number | null;
  discountAmount?: number | null;
  lineItems: InvoiceLinePayload[];
}

export const createInvoice = (body: CreateInvoicePayload) =>
  apiPost<{ data: Invoice }>("/invoices", body).then((r) => r.data);

export const updateInvoice = (
  id: string,
  body: Partial<{
    currency: string;
    dueDate: string | null;
    notes: string | null;
    taxAmount: number | null;
    discountAmount: number | null;
  }>,
) => apiPatch<{ data: Invoice }>(`/invoices/${id}`, body).then((r) => r.data);

export const addInvoiceLine = (id: string, body: InvoiceLinePayload) =>
  apiPost<{ data: Invoice }>(`/invoices/${id}/line-items`, body).then((r) => r.data);

export const updateInvoiceLine = (id: string, lineId: string, body: Partial<InvoiceLinePayload>) =>
  apiPatch<{ data: Invoice }>(`/invoices/${id}/line-items/${lineId}`, body).then((r) => r.data);

export const deleteInvoiceLine = (id: string, lineId: string) =>
  apiDelete<{ data: Invoice }>(`/invoices/${id}/line-items/${lineId}`).then((r) => r.data);

export const sendInvoice = (id: string, body: { dueDate?: string | null } = {}) =>
  apiPost<{ data: Invoice }>(`/invoices/${id}/send`, body).then((r) => r.data);

export const recordPayment = (
  id: string,
  body: { reference?: string; paidAt?: string | null; amount?: number | null; note?: string | null },
) => apiPost<{ data: Invoice }>(`/invoices/${id}/pay`, body).then((r) => r.data);

export const voidInvoice = (id: string, reason?: string) =>
  apiPost<{ data: Invoice }>(`/invoices/${id}/void`, { reason }).then((r) => r.data);
