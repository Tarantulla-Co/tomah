import { Prisma } from "@tomah/db";

/**
 * Decimal-safe money math for quote / invoice totals. Never use JS floats for
 * currency — every amount is a Prisma.Decimal (mirrors Decimal(12,2) columns)
 * and serialised to the client as a plain string (see the controllers' `dec`).
 */
export type DecimalInput = Prisma.Decimal | string | number;

export const toDec = (v: DecimalInput | null | undefined): Prisma.Decimal =>
  new Prisma.Decimal(v ?? 0);

/** Round half-up to 2dp — the storage precision of every money column. */
export const round2 = (v: Prisma.Decimal): Prisma.Decimal =>
  v.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

export const lineTotal = (unitPrice: DecimalInput, quantity: number): Prisma.Decimal =>
  round2(toDec(unitPrice).mul(quantity));

/**
 * Roll a set of priced lines up into document totals.
 * total = subtotal + tax − discount (never below zero).
 */
export function rollup(
  lines: Array<{ lineTotal: DecimalInput | null }>,
  opts: { taxAmount?: DecimalInput | null; discountAmount?: DecimalInput | null } = {},
) {
  const subtotal = lines.reduce((acc, l) => acc.add(toDec(l.lineTotal)), new Prisma.Decimal(0));
  const taxAmount = round2(toDec(opts.taxAmount));
  const discountAmount = round2(toDec(opts.discountAmount));
  let total = round2(subtotal).add(taxAmount).sub(discountAmount);
  if (total.lessThan(0)) total = new Prisma.Decimal(0);
  return { subtotal: round2(subtotal), taxAmount, discountAmount, total: round2(total) };
}
