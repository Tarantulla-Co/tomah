/**
 * Accounting-software integration abstraction.
 *
 * Phase 4 defines this interface and ships only the no-op adapter. Phase 8 wires
 * up settings (which system, credentials, connection status) and adds real
 * adapters (QuickBooks / Xero / Zoho …) — point ACCOUNTING_ADAPTER at one and no
 * controller changes are required. Same swappable-adapter pattern as lib/storage.
 *
 * The single operation is "push a finalised (paid) invoice out". The result's
 * `ref` is stored on Invoice.accountingRef; failures are caught by the caller
 * and recorded on Invoice.accountingError with status FAILED — a paid invoice is
 * never blocked by a sync problem.
 */
export interface AccountingInvoice {
  invoiceNumber: string;
  currency: string;
  issueDate: Date;
  dueDate: Date | null;
  paidAt: Date | null;
  paymentReference: string | null;
  customer: { name: string; email: string };
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }>;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  total: string;
}

export interface AccountingSyncResult {
  /** External record id in the accounting system. */
  ref: string;
  syncedAt: Date;
}

export interface AccountingAdapter {
  readonly name: string;
  /** `false` for the no-op adapter — callers skip the sync attempt entirely. */
  readonly connected: boolean;
  syncInvoice(invoice: AccountingInvoice): Promise<AccountingSyncResult>;
}
