import { apiGet, apiPatch, apiPost } from "./api";

export interface PaymentsSettings {
  provider: string;
  online: boolean;
  publicKey: string | null;
  secretKeySet: boolean;
  testMode: boolean;
}

export interface ShippingRule {
  region: string;
  fee: string;
}
export interface ShippingSettings {
  freeShippingThreshold: string | null;
  defaultFee: string;
  rules: ShippingRule[];
}

export interface TaxRule {
  region: string;
  rate: number;
}
export interface TaxSettings {
  defaultRate: number;
  rules: TaxRule[];
}

export interface AccountingSettings {
  adapter: string;
  connected: boolean;
  autoSyncOnPayment: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: "success" | "partial" | "failed" | null;
  lastSyncSummary: string | null;
}

export interface AllSettings {
  payments: PaymentsSettings;
  shipping: ShippingSettings;
  tax: TaxSettings;
  accounting: AccountingSettings;
}

export const getSettings = (signal?: AbortSignal) =>
  apiGet<{ data: AllSettings }>("/settings", signal).then((r) => r.data);

export const updatePayments = (body: {
  publicKey?: string | null;
  secretKey?: string;
  testMode?: boolean;
}) => apiPatch<{ data: PaymentsSettings }>("/settings/payments", body).then((r) => r.data);

export const updateShipping = (body: Partial<ShippingSettings>) =>
  apiPatch<{ data: ShippingSettings }>("/settings/shipping", body).then((r) => r.data);

export const updateTax = (body: Partial<TaxSettings>) =>
  apiPatch<{ data: TaxSettings }>("/settings/tax", body).then((r) => r.data);

export const updateAccounting = (body: { autoSyncOnPayment?: boolean }) =>
  apiPatch<{ data: AccountingSettings }>("/settings/accounting", body).then((r) => r.data);

export interface AccountingSyncResult {
  ran: boolean;
  adapter: string;
  reason?: string;
  pending?: number;
  synced: number;
  failed: number;
  results?: Array<{ invoiceNumber: string; ok: boolean; error: string | null }>;
}

export const runAccountingSync = () =>
  apiPost<{ data: AccountingSyncResult }>("/accounting/sync", {}).then((r) => r.data);
