import { z } from "zod";

/** Accepts a number or numeric string, yields a non-negative number rounded to
 *  2dp. Shared by the quote / invoice schemas. */
export const money = z.union([z.number(), z.string()]).transform((v, ctx) => {
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n) || n < 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Must be a non-negative number" });
    return z.NEVER;
  }
  return Math.round(n * 100) / 100;
});

export const moneyNullable = money.nullable();

/** ISO date string or Date -> Date. */
export const dateInput = z
  .union([z.string().datetime({ offset: true }), z.string().date(), z.date()])
  .transform((v) => (v instanceof Date ? v : new Date(v)));

/** Standard list pagination — extend with `.extend({ ... })`. */
export const paginationQuery = z.object({
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
