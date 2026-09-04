import { prisma } from "@tomah/db";

/**
 * THE wholesale-pricing gate.
 *
 * A customer may see wholesale prices / MOQ and request quotes only when they
 * have a WholesaleAccount in status APPROVED. Every other part of the system
 * (quote builder in Phase 4, customer view in Phase 6, and the storefront)
 * must funnel through this rule — do not re-implement the check ad hoc.
 */
export function accountUnlocksWholesale(account: { status: string } | null | undefined): boolean {
  return account?.status === "APPROVED";
}

export async function customerHasWholesaleAccess(customerId: string): Promise<boolean> {
  const account = await prisma.wholesaleAccount.findUnique({
    where: { customerId },
    select: { status: true },
  });
  return accountUnlocksWholesale(account);
}
