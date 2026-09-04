import { z } from "zod";
import { dateInput, money, paginationQuery } from "./common.js";

export const ORDER_STATUSES = [
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
] as const;

export const SHIPPING_CARRIERS = ["USPS", "UPS", "FEDEX", "DHL"] as const;

/* -------------------------------- list query ------------------------------- */

export const listOrdersQuery = paginationQuery.extend({
  status: z.enum(ORDER_STATUSES).optional(),
  carrier: z.enum(SHIPPING_CARRIERS).optional(),
  sort: z
    .enum([
      "createdAt",
      "-createdAt",
      "total",
      "-total",
      "orderNumber",
      "-orderNumber",
    ])
    .default("-createdAt"),
});
export type ListOrdersQuery = z.infer<typeof listOrdersQuery>;

/* ------------------------------ edit shipment ---------------------------- */
// Correct carrier / tracking / internal note without a status change. Blocked
// once the order is CANCELLED or REFUNDED.

export const updateOrderSchema = z.object({
  carrier: z.enum(SHIPPING_CARRIERS).nullish(),
  trackingNumber: z.string().trim().max(120).nullish(),
  internalNote: z.string().trim().max(2000).nullish(),
});
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;

/* ---------------------------- status transitions ------------------------ */

export const shipOrderSchema = z.object({
  carrier: z.enum(SHIPPING_CARRIERS),
  trackingNumber: z.string().trim().min(1, "A tracking number is required").max(120),
  shippedAt: dateInput.nullish(),
});
export type ShipOrderInput = z.infer<typeof shipOrderSchema>;

export const deliverOrderSchema = z.object({
  deliveredAt: dateInput.nullish(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required").max(2000),
});

export const refundOrderSchema = z.object({
  /** Defaults to the full order total. Partial amounts are recorded but the
   *  status still becomes REFUNDED (no partial-refund status in the schema). */
  amount: money.nullish(),
  reason: z.string().trim().min(1, "A reason is required").max(2000),
});
export type RefundOrderInput = z.infer<typeof refundOrderSchema>;
