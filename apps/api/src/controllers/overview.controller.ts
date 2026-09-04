import type { Request, Response } from "express";
import { prisma } from "@tomah/db";

/**
 * GET /api/v1/overview
 * Lightweight counts for the dashboard landing page. Revenue / financial
 * figures are intentionally NOT here in Phase 1 — Phase 8 adds role-scoped
 * reporting. Everything below is non-sensitive operational volume.
 */
export async function getOverview(_req: Request, res: Response) {
  const [
    staffCount,
    retailCustomers,
    wholesaleCustomers,
    publishedProducts,
    draftProducts,
    pendingWholesale,
    openQuotes,
    unpaidInvoices,
    ordersToShip,
  ] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.customer.count({ where: { type: "RETAIL" } }),
    prisma.customer.count({ where: { type: "WHOLESALE" } }),
    prisma.product.count({ where: { isPublished: true } }),
    prisma.product.count({ where: { isPublished: false } }),
    prisma.wholesaleAccount.count({ where: { status: "PENDING" } }),
    prisma.quote.count({ where: { status: { in: ["REQUESTED", "DRAFT", "SENT"] } } }),
    prisma.invoice.count({ where: { status: { in: ["SENT", "OVERDUE"] } } }),
    prisma.order.count({ where: { status: { in: ["PAID", "PROCESSING"] } } }),
  ]);

  res.json({
    staffCount,
    customers: { retail: retailCustomers, wholesale: wholesaleCustomers },
    products: { published: publishedProducts, draft: draftProducts },
    actionQueue: {
      pendingWholesaleApplications: pendingWholesale,
      openQuotes,
      unpaidInvoices,
      ordersToShip,
    },
  });
}
