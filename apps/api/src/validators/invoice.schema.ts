import { z } from "zod";
import { dateInput, money, paginationQuery } from "./common.js";

export const INVOICE_STATUSES = ["DRAFT", "SENT", "PAID", "OVERDUE", "VOID"] as const;

/* -------------------------------- list query ------------------------------- */

export const listInvoicesQuery = paginationQuery.extend({
  status: z.enum(INVOICE_STATUSES).optional(),
  sort: z
    .enum(["createdAt", "-createdAt", "dueDate", "-dueDate", "total", "-total"])
    .default("-createdAt"),
});
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuery>;

/* -------------------------------- line items ------------------------------- */
// Invoice lines are always priced (unlike quote lines).

export const invoiceLineItemSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: z.coerce.number().int().min(1),
  unitPrice: money,
  position: z.coerce.number().int().min(0).optional(),
});
export type InvoiceLineItemInput = z.infer<typeof invoiceLineItemSchema>;

export const updateInvoiceLineItemSchema = invoiceLineItemSchema.partial();

/* ------------------------------ customer target -------------------------- */

const customerTarget = z
  .object({
    customerId: z.string().uuid().optional(),
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    email: z.string().email().toLowerCase().trim().optional(),
    phone: z.string().trim().max(40).nullish(),
  })
  .refine((v) => v.customerId || v.email, {
    message: "Provide customerId or an email to create/link a customer",
    path: ["customerId"],
  })
  .refine((v) => v.customerId || (v.firstName && v.lastName), {
    message: "firstName and lastName are required when creating a customer by email",
    path: ["firstName"],
  });

/* ------------------------------ create (standalone) --------------------- */
// Invoices from a quote are created via POST /quotes/:id/convert. This is for a
// direct, quote-less invoice.

export const createInvoiceSchema = z.object({
  customer: customerTarget,
  currency: z.string().trim().length(3).toUpperCase().default("USD"),
  dueDate: dateInput.nullish(),
  notes: z.string().trim().max(2000).nullish(),
  taxAmount: money.nullish(),
  discountAmount: money.nullish(),
  lineItems: z.array(invoiceLineItemSchema).min(1, "At least one line item is required"),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

/* --------------------------------- update -------------------------------- */
// DRAFT only.

export const updateInvoiceSchema = z.object({
  currency: z.string().trim().length(3).toUpperCase().optional(),
  dueDate: dateInput.nullish(),
  notes: z.string().trim().max(2000).nullish(),
  taxAmount: money.nullish(),
  discountAmount: money.nullish(),
});
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;

/* ---------------------------- status transitions ------------------------ */

export const sendInvoiceSchema = z.object({
  dueDate: dateInput.nullish(),
});

/** Record a payment received out-of-band (bank transfer, or a Stripe payment
 *  reconciled from the dashboard). Online Stripe collection is on the storefront
 *  checkout path; this endpoint stays for manually-reconciled invoices. */
export const recordPaymentSchema = z.object({
  reference: z.string().trim().max(200).nullish(),
  paidAt: dateInput.nullish(),
  amount: money.nullish(),
  note: z.string().trim().max(500).nullish(),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const voidInvoiceSchema = z.object({
  reason: z.string().trim().max(500).nullish(),
});
