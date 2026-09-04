import type { Request, Response } from "express";
import { prisma, Prisma } from "@tomah/db";
import { round2, toDec } from "../lib/money.js";
import type { ReportRangeQuery, TopProductsQuery } from "../validators/settings.schema.js";

const ACTIVE_ORDER_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;
const dec = (v: Prisma.Decimal) => round2(v).toString();

/** Resolve the from/to window. Default: the last 30 days (inclusive). */
function resolveRange(q: ReportRangeQuery) {
  const to = q.to ? new Date(`${q.to}T23:59:59.999Z`) : new Date();
  const from = q.from
    ? new Date(`${q.from}T00:00:00.000Z`)
    : new Date(to.getTime() - 29 * 86_400_000);
  return { from, to };
}

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

/* ------------------------------- summary ----------------------------- */

export async function getSummary(req: Request, res: Response) {
  const q = req.query as unknown as ReportRangeQuery;
  const { from, to } = resolveRange(q);
  const inRange = { gte: from, lte: to };

  const [orders, paidInvoices, outstanding, refundRows, quoteSent, quoteApproved, quoteConverted] =
    await Promise.all([
      prisma.order.findMany({
        where: { createdAt: inRange, status: { in: [...ACTIVE_ORDER_STATUSES] } },
        select: { total: true, createdAt: true, customer: { select: { type: true } } },
      }),
      prisma.invoice.findMany({
        where: { status: "PAID", paidAt: inRange },
        select: { total: true, paidAt: true },
      }),
      prisma.invoice.aggregate({
        where: { status: { in: ["SENT", "OVERDUE"] } },
        _sum: { total: true },
        _count: { _all: true },
      }),
      prisma.order.findMany({
        where: { status: "REFUNDED", refundedAt: inRange },
        select: { refundAmount: true },
      }),
      prisma.quote.count({ where: { sentAt: inRange } }),
      prisma.quote.count({ where: { approvedAt: inRange } }),
      prisma.quote.count({ where: { status: "CONVERTED", approvedAt: inRange } }),
    ]);

  let retailOrders = new Prisma.Decimal(0);
  let wholesaleOrders = new Prisma.Decimal(0);
  const series = new Map<string, { retail: Prisma.Decimal; wholesale: Prisma.Decimal }>();
  const bucket = (k: string) => {
    if (!series.has(k)) series.set(k, { retail: new Prisma.Decimal(0), wholesale: new Prisma.Decimal(0) });
    return series.get(k)!;
  };

  for (const o of orders) {
    const amt = toDec(o.total);
    const b = bucket(monthKey(o.createdAt));
    if (o.customer.type === "WHOLESALE") {
      wholesaleOrders = wholesaleOrders.add(amt);
      b.wholesale = b.wholesale.add(amt);
    } else {
      retailOrders = retailOrders.add(amt);
      b.retail = b.retail.add(amt);
    }
  }

  let wholesaleInvoices = new Prisma.Decimal(0);
  for (const inv of paidInvoices) {
    const amt = toDec(inv.total);
    wholesaleInvoices = wholesaleInvoices.add(amt);
    if (inv.paidAt) bucket(monthKey(inv.paidAt)).wholesale = bucket(monthKey(inv.paidAt)).wholesale.add(amt);
  }

  const refundTotal = refundRows.reduce((acc, r) => acc.add(toDec(r.refundAmount)), new Prisma.Decimal(0));
  const orderRevenue = retailOrders.add(wholesaleOrders);
  const total = orderRevenue.add(wholesaleInvoices);
  const orderCount = orders.length;

  res.json({
    data: {
      range: { from: from.toISOString(), to: to.toISOString() },
      revenue: {
        retailOrders: dec(retailOrders),
        wholesaleOrders: dec(wholesaleOrders),
        wholesaleInvoices: dec(wholesaleInvoices),
        total: dec(total),
      },
      byChannel: {
        retail: dec(retailOrders),
        wholesale: dec(wholesaleOrders.add(wholesaleInvoices)),
      },
      orders: {
        count: orderCount,
        avgOrderValue: orderCount ? dec(orderRevenue.div(orderCount)) : "0.00",
      },
      refunds: { count: refundRows.length, total: dec(refundTotal) },
      invoices: {
        paid: paidInvoices.length,
        paidTotal: dec(paidInvoices.reduce((a, i) => a.add(toDec(i.total)), new Prisma.Decimal(0))),
        outstanding: outstanding._count._all,
        outstandingTotal: dec(toDec(outstanding._sum.total)),
      },
      quotes: {
        sent: quoteSent,
        approved: quoteApproved,
        converted: quoteConverted,
        conversionRate: quoteSent ? Math.round((quoteConverted / quoteSent) * 100) / 100 : 0,
      },
      series: [...series.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, v]) => ({
          period,
          retail: dec(v.retail),
          wholesale: dec(v.wholesale),
          total: dec(v.retail.add(v.wholesale)),
        })),
    },
  });
}

/* ----------------------------- top products ------------------------- */

export async function getTopProducts(req: Request, res: Response) {
  const q = req.query as unknown as TopProductsQuery;
  const { from, to } = resolveRange(q);

  const groups = await prisma.orderItem.groupBy({
    by: ["productId", "sku", "name"],
    where: { order: { createdAt: { gte: from, lte: to }, status: { in: [...ACTIVE_ORDER_STATUSES] } } },
    _sum: { quantity: true, lineTotal: true },
    orderBy: { _sum: { lineTotal: "desc" } },
    take: q.limit,
  });

  res.json({
    data: {
      range: { from: from.toISOString(), to: to.toISOString() },
      products: groups.map((g) => ({
        productId: g.productId,
        sku: g.sku,
        name: g.name,
        unitsSold: g._sum.quantity ?? 0,
        revenue: dec(toDec(g._sum.lineTotal)),
      })),
    },
  });
}
