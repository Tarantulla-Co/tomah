import { prisma, Prisma } from "@tomah/db";
import { accounting } from "./index.js";

const dec = (v: Prisma.Decimal | null) => (v == null ? "0" : v.toString());

export interface InvoiceSyncOutcome {
  invoiceId: string;
  invoiceNumber: string;
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

/**
 * Push one paid invoice to the configured accounting adapter. Never throws:
 * the outcome (and any error) is recorded on the invoice row
 * (`accountingSyncStatus` / `accountingError`) and returned. With the no-op
 * adapter the invoice is left untouched and `skipped: true` is returned.
 */
export async function syncInvoiceToAccounting(invoiceId: string): Promise<InvoiceSyncOutcome> {
  const inv = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: {
      customer: { select: { firstName: true, lastName: true, email: true } },
      lineItems: { orderBy: { position: "asc" } },
    },
  });

  if (!accounting.connected) {
    return { invoiceId, invoiceNumber: inv.invoiceNumber, ok: false, skipped: true, error: "No accounting adapter is configured" };
  }

  try {
    const result = await accounting.syncInvoice({
      invoiceNumber: inv.invoiceNumber,
      currency: inv.currency,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      paidAt: inv.paidAt,
      paymentReference: inv.paymentReference,
      customer: {
        name: `${inv.customer.firstName} ${inv.customer.lastName}`.trim(),
        email: inv.customer.email,
      },
      lineItems: inv.lineItems.map((li) => ({
        description: li.description,
        quantity: li.quantity,
        unitPrice: dec(li.unitPrice),
        lineTotal: dec(li.lineTotal),
      })),
      subtotal: dec(inv.subtotal),
      taxAmount: dec(inv.taxAmount),
      discountAmount: dec(inv.discountAmount),
      total: dec(inv.total),
    });
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        accountingSyncStatus: "SYNCED",
        accountingAdapter: accounting.name,
        accountingRef: result.ref,
        accountingSyncedAt: result.syncedAt,
        accountingError: null,
      },
    });
    return { invoiceId, invoiceNumber: inv.invoiceNumber, ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        accountingSyncStatus: "FAILED",
        accountingAdapter: accounting.name,
        accountingError: message,
      },
    });
    return { invoiceId, invoiceNumber: inv.invoiceNumber, ok: false, error: message };
  }
}
