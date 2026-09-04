import { z } from "zod";
import { money } from "./common.js";

/* ------------------------------- payments ---------------------------- */

export const updatePaymentsSchema = z
  .object({
    publicKey: z.string().trim().max(200).nullish(),
    // Write-only. Send "" to clear a stored secret; omit to leave it unchanged.
    secretKey: z.string().trim().max(400).optional(),
    testMode: z.boolean().optional(),
  })
  .strict();

/* ------------------------------- shipping ---------------------------- */

const shippingRule = z.object({
  region: z.string().trim().min(1).max(80),
  fee: money,
});

export const updateShippingSchema = z
  .object({
    freeShippingThreshold: money.nullish(),
    defaultFee: money.optional(),
    rules: z.array(shippingRule).max(200).optional(),
  })
  .strict();

/* --------------------------------- tax ------------------------------ */

const rate = z.coerce.number().min(0).max(1);

const taxRule = z.object({
  region: z.string().trim().min(1).max(80),
  rate,
});

export const updateTaxSchema = z
  .object({
    defaultRate: rate.optional(),
    rules: z.array(taxRule).max(200).optional(),
  })
  .strict();

/* ------------------------------ accounting -------------------------- */

export const updateAccountingSchema = z
  .object({
    autoSyncOnPayment: z.boolean().optional(),
  })
  .strict();

/* -------------------------------- reports -------------------------- */

export const reportRangeQuery = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});
export type ReportRangeQuery = z.infer<typeof reportRangeQuery>;

export const topProductsQuery = reportRangeQuery.extend({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type TopProductsQuery = z.infer<typeof topProductsQuery>;
