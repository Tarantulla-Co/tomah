import { apiGet, apiPost } from "./api";

export type WholesaleStatus = "PENDING" | "APPROVED" | "REJECTED";

export const WHOLESALE_STATUS_LABELS: Record<WholesaleStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export interface WholesaleAccount {
  id: string;
  status: WholesaleStatus;
  unlocksWholesalePricing: boolean;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    type: "RETAIL" | "WHOLESALE";
  };
  application: {
    businessName: string;
    businessRegistrationNumber: string | null;
    taxId: string | null;
    businessType: string | null;
    website: string | null;
    contactName: string;
    contactEmail: string;
    contactPhone: string | null;
    estimatedMonthlyVolume: string | null;
    applicationNotes: string | null;
  };
  review: {
    reviewedBy: { id: string; name: string } | null;
    reviewedAt: string | null;
    reviewNotes: string | null;
    rejectionReason: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface WholesaleAccountDetail extends WholesaleAccount {
  customerActivity: { orders: number; quotes: number };
  auditTrail: Array<{
    id: string;
    action: string;
    summary: string | null;
    actor: string;
    at: string;
    metadata: unknown;
  }>;
}

export interface WholesaleListResponse {
  data: WholesaleAccount[];
  pagination: { page: number; pageSize: number; total: number; pageCount: number };
  statusCounts: Record<WholesaleStatus, number>;
}

function qs(params: object): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params) as [string, unknown][]) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const listWholesaleAccounts = (
  params: { q?: string; status?: WholesaleStatus; page?: number },
  signal?: AbortSignal,
) => apiGet<WholesaleListResponse>(`/wholesale-accounts${qs(params)}`, signal);

export const getWholesaleAccount = (id: string, signal?: AbortSignal) =>
  apiGet<{ data: WholesaleAccountDetail }>(`/wholesale-accounts/${id}`, signal).then((r) => r.data);

export const approveWholesaleAccount = (id: string, reviewNotes?: string) =>
  apiPost<{ data: WholesaleAccount }>(`/wholesale-accounts/${id}/approve`, { reviewNotes }).then((r) => r.data);

export const rejectWholesaleAccount = (id: string, rejectionReason: string, reviewNotes?: string) =>
  apiPost<{ data: WholesaleAccount }>(`/wholesale-accounts/${id}/reject`, {
    rejectionReason,
    reviewNotes,
  }).then((r) => r.data);

export interface NewApplicationInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  businessName: string;
  businessType?: string;
  website?: string;
  businessRegistrationNumber?: string;
  taxId?: string;
  estimatedMonthlyVolume?: string;
  applicationNotes?: string;
}

export const createWholesaleApplication = (body: NewApplicationInput) =>
  apiPost<{ data: WholesaleAccount }>("/wholesale-accounts", body).then((r) => r.data);
