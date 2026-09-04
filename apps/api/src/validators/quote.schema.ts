import { z } from "zod";
import { dateInput, money, paginationQuery } from "./common.js";

export const QUOTE_STATUSES = [
  "REQUESTED",
  "DRAFT",
  "SENT",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "CONVERTED",
] as const;

/* -------------------------------- list query ------------------------------- */

export const listQuotesQuery = paginationQuery.extend({
  status: z.enum(QUOTE_STATUSES).optional(),
  sort: z
    .enum(["createdAt", "-createdAt", "quoteNumber", "-quoteNumber"])
    .default("-createdAt"),
});
export type ListQuotesQuery = z.infer<typeof listQuotesQuery>;

/* ------------------------------ customer target ---------------------------- */
// Either an existing customerId, or enough to upsert a WHOLESALE customer by
// email (mirrors the wholesale application intake).

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

/* -------------------------------- line items ------------------------------- */

export const quoteLineItemSchema = z.object({
  productId: z.string().uuid().nullish(),
  variantId: z.string().uuid().nullish(),
  description: z.string().trim().min(1).max(500),
  quantity: z.coerce.number().int().min(1),
  unitPrice: money.nullish(), // null until staff prices the line
  notes: z.string().trim().max(500).nullish(),
  position: z.coerce.number().int().min(0).optional(),
});
export type QuoteLineItemInput = z.infer<typeof quoteLineItemSchema>;

export const updateQuoteLineItemSchema = quoteLineItemSchema.partial();

/* --------------------------------- create -------------------------------- */

export const createQuoteSchema = z.object({
  customer: customerTarget,
  requestNote: z.string().trim().max(2000).nullish(),
  internalNote: z.string().trim().max(2000).nullish(),
  currency: z.string().trim().length(3).toUpperCase().default("USD"),
  validUntil: dateInput.nullish(),
  taxAmount: money.nullish(),
  discountAmount: money.nullish(),
  lineItems: z.array(quoteLineItemSchema).default([]),
});
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;

/* --------------------------------- update -------------------------------- */
// Header fields only; line items have their own endpoints. Editable while the
// quote is REQUESTED or DRAFT (internalNote is editable in any state).

export const updateQuoteSchema = z.object({
  requestNote: z.string().trim().max(2000).nullish(),
  internalNote: z.string().trim().max(2000).nullish(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  validUntil: dateInput.nullish(),
  taxAmount: money.nullish(),
  discountAmount: money.nullish(),
});
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;

/* ---------------------------- status transitions ------------------------ */

export const sendQuoteSchema = z.object({
  validUntil: dateInput.nullish(),
  internalNote: z.string().trim().max(2000).nullish(),
});

export const approveQuoteSchema = z.object({
  note: z.string().trim().max(2000).nullish(),
});

export const rejectQuoteSchema = z.object({
  rejectionReason: z.string().trim().min(1, "A reason is required").max(2000),
});

export const convertQuoteSchema = z.object({
  dueDate: dateInput.nullish(),
  notes: z.string().trim().max(2000).nullish(),
});
export type ConvertQuoteInput = z.infer<typeof convertQuoteSchema>;
