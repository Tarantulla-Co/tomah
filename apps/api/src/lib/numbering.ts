import { prisma } from "@tomah/db";

/**
 * Human-facing document numbers are minted here by the admin API (the storefront
 * displays them but never generates them — see docs/DATA_MODEL.md). Format:
 * `<prefix><digits>` starting at 4 digits, widening on repeated collisions.
 * Mirrors the collision-retry approach in lib/slug.ts' uniqueSlug.
 */
async function uniqueNumber(
  prefix: string,
  taken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  for (let i = 0; i < 60; i++) {
    const span = 9000 * 10 ** Math.floor(i / 20);
    const candidate = `${prefix}${1000 + Math.floor(Math.random() * span)}`;
    if (!(await taken(candidate))) return candidate;
  }
  // Practically unreachable — fall back to a timestamp so we never loop forever.
  return `${prefix}${Date.now()}`;
}

export function nextOrderNumber(): Promise<string> {
  return uniqueNumber("TMH-", async (n) =>
    (await prisma.order.findUnique({ where: { orderNumber: n }, select: { id: true } })) != null,
  );
}

export function nextQuoteNumber(): Promise<string> {
  return uniqueNumber("TMH-Q-", async (n) =>
    (await prisma.quote.findUnique({ where: { quoteNumber: n }, select: { id: true } })) != null,
  );
}

export function nextInvoiceNumber(): Promise<string> {
  return uniqueNumber("TMH-INV-", async (n) =>
    (await prisma.invoice.findUnique({ where: { invoiceNumber: n }, select: { id: true } })) != null,
  );
}
