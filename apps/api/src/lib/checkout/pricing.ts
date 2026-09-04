import { Prisma } from "@tomah/db";
import { round2, toDec } from "../money.js";
import { readGroup, type ShippingSettings, type TaxSettings } from "../settings.js";

/**
 * Storefront checkout pricing. The admin API is the single owner of what a
 * retail order actually costs — the storefront sends a cart, this computes the
 * authoritative subtotal / shipping / tax / total from the saved `shipping` and
 * `tax` settings groups (see lib/settings.ts).
 *
 * Rules:
 *   • subtotal   — Σ round2(unitPrice × quantity)
 *   • shipping   — 0 when a free-shipping threshold is set and met; otherwise
 *                  the destination region/country rule fee, else the default fee
 *   • tax        — round2(subtotal × rate) on the merchandise subtotal only
 *                  (shipping is not taxed), region/country rule rate else default
 *   • discount   — 0 for now (storefront has no coupon flow yet)
 *   • total      — subtotal + shipping + tax − discount, never below zero
 */

export interface PricedLine {
  unitPrice: Prisma.Decimal;
  quantity: number;
}

export interface OrderTotals {
  subtotal: Prisma.Decimal;
  shippingFee: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  total: Prisma.Decimal;
}

export interface Destination {
  region: string;
  country: string;
}

function ruleFor<T extends { region: string }>(
  rules: readonly T[],
  dest: Destination,
): T | undefined {
  const region = dest.region.trim().toLowerCase();
  const country = dest.country.trim().toLowerCase();
  return rules.find((r) => {
    const key = r.region.trim().toLowerCase();
    return key === region || key === country;
  });
}

export async function computeOrderTotals(
  lines: PricedLine[],
  dest: Destination,
): Promise<OrderTotals> {
  const [shipping, tax] = (await Promise.all([readGroup("shipping"), readGroup("tax")])) as [
    ShippingSettings,
    TaxSettings,
  ];

  const subtotal = round2(
    lines.reduce(
      (acc, l) => acc.add(round2(toDec(l.unitPrice).mul(l.quantity))),
      new Prisma.Decimal(0),
    ),
  );

  let shippingFee: Prisma.Decimal;
  const threshold =
    shipping.freeShippingThreshold != null ? toDec(shipping.freeShippingThreshold) : null;
  if (threshold != null && subtotal.greaterThanOrEqualTo(threshold)) {
    shippingFee = new Prisma.Decimal(0);
  } else {
    const rule = ruleFor(shipping.rules ?? [], dest);
    shippingFee = round2(toDec(rule ? rule.fee : shipping.defaultFee));
  }

  const taxRule = ruleFor(tax.rules ?? [], dest);
  const rate = taxRule ? taxRule.rate : tax.defaultRate;
  const taxAmount = round2(subtotal.mul(rate ?? 0));

  const discountAmount = new Prisma.Decimal(0);
  let total = round2(subtotal.add(shippingFee).add(taxAmount).sub(discountAmount));
  if (total.lessThan(0)) total = new Prisma.Decimal(0);

  return { subtotal, shippingFee, taxAmount, discountAmount, total };
}
