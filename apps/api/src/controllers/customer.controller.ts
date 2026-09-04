import type { Request, Response } from "express";
import { prisma, Prisma } from "@tomah/db";
import { HttpError } from "../lib/http-error.js";
import type { ListCustomersQuery } from "../validators/customer.schema.js";

type Decimalish = Prisma.Decimal | null;
const dec = (v: Decimalish) => (v == null ? null : v.toString());

/* --------------------------------- list -------------------------------- */

const LIST_WITH = {
  include: {
    wholesaleAccount: { select: { id: true, status: true } },
    _count: { select: { orders: true, quotes: true, invoices: true } },
  },
} satisfies Prisma.CustomerDefaultArgs;

type CustomerListRow = Prisma.CustomerGetPayload<typeof LIST_WITH>;

function serializeListRow(c: CustomerListRow) {
  return {
    id: c.id,
    type: c.type,
    name: `${c.firstName} ${c.lastName}`.trim(),
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    companyName: c.companyName,
    phone: c.phone,
    wholesale: {
      hasAccount: c.wholesaleAccount != null,
      status: c.wholesaleAccount?.status ?? null,
      unlocksWholesalePricing: c.wholesaleAccount?.status === "APPROVED",
    },
    counts: {
      orders: c._count.orders,
      quotes: c._count.quotes,
      invoices: c._count.invoices,
    },
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export async function listCustomers(req: Request, res: Response) {
  const q = req.query as unknown as ListCustomersQuery;

  const where: Prisma.CustomerWhereInput = {};
  if (q.type) where.type = q.type === "retail" ? "RETAIL" : "WHOLESALE";
  if (q.q) {
    where.OR = [
      { firstName: { contains: q.q, mode: "insensitive" } },
      { lastName: { contains: q.q, mode: "insensitive" } },
      { email: { contains: q.q, mode: "insensitive" } },
      { companyName: { contains: q.q, mode: "insensitive" } },
    ];
  }

  const orderBy: Prisma.CustomerOrderByWithRelationInput =
    q.sort === "createdAt"
      ? { createdAt: "asc" }
      : q.sort === "name"
        ? { firstName: "asc" }
        : q.sort === "-name"
          ? { firstName: "desc" }
          : q.sort === "orders"
            ? { orders: { _count: "asc" } }
            : q.sort === "-orders"
              ? { orders: { _count: "desc" } }
              : { createdAt: "desc" };

  const [total, rows, groups] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      ...LIST_WITH,
    }),
    prisma.customer.groupBy({ by: ["type"], _count: { _all: true } }),
  ]);

  const typeCounts = { RETAIL: 0, WHOLESALE: 0 } as Record<string, number>;
  for (const g of groups) typeCounts[g.type] = g._count._all;

  res.json({
    data: rows.map(serializeListRow),
    pagination: { page: q.page, pageSize: q.pageSize, total, pageCount: Math.ceil(total / q.pageSize) },
    typeCounts,
  });
}

/* --------------------------------- detail ------------------------------ */

function serializeAddress(a: {
  id: string; label: string | null; contactName: string | null;
  line1: string; line2: string | null; city: string; region: string;
  postalCode: string; country: string; phone: string | null;
  isDefaultShipping: boolean; isDefaultBilling: boolean;
}) {
  return {
    id: a.id,
    label: a.label,
    contactName: a.contactName,
    line1: a.line1,
    line2: a.line2,
    city: a.city,
    region: a.region,
    postalCode: a.postalCode,
    country: a.country,
    phone: a.phone,
    isDefaultShipping: a.isDefaultShipping,
    isDefaultBilling: a.isDefaultBilling,
  };
}

export async function getCustomer(req: Request, res: Response) {
  const id = req.params.id!;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      addresses: { orderBy: [{ isDefaultShipping: "desc" }, { createdAt: "asc" }] },
      wholesaleAccount: {
        select: {
          id: true, status: true, businessName: true, reviewedAt: true,
          reviewedBy: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!customer) throw HttpError.notFound("Customer not found");

  const [orders, quotes, invoices, orderAgg, refundAgg] = await Promise.all([
    prisma.order.findMany({
      // Exclude storefront carts that never completed payment.
      where: { customerId: id, status: { not: "PENDING_PAYMENT" } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true, orderNumber: true, status: true, total: true, currency: true,
        createdAt: true, carrier: true, trackingNumber: true,
      },
    }),
    prisma.quote.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true, quoteNumber: true, status: true, total: true, currency: true,
        createdAt: true, validUntil: true,
      },
    }),
    prisma.invoice.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true, invoiceNumber: true, status: true, total: true, currency: true,
        issueDate: true, dueDate: true,
      },
    }),
    prisma.order.aggregate({
      where: {
        customerId: id,
        status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] },
      },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      where: { customerId: id, status: "REFUNDED" },
      _sum: { refundAmount: true },
      _count: { _all: true },
    }),
  ]);

  const openQuotes = quotes.filter((q) => ["REQUESTED", "DRAFT", "SENT"].includes(q.status)).length;
  const unpaidInvoices = invoices.filter((i) => ["SENT", "OVERDUE"].includes(i.status)).length;

  res.json({
    data: {
      id: customer.id,
      type: customer.type,
      name: `${customer.firstName} ${customer.lastName}`.trim(),
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      companyName: customer.companyName,
      phone: customer.phone,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      wholesaleAccount: customer.wholesaleAccount
        ? {
            id: customer.wholesaleAccount.id,
            status: customer.wholesaleAccount.status,
            businessName: customer.wholesaleAccount.businessName,
            unlocksWholesalePricing: customer.wholesaleAccount.status === "APPROVED",
            reviewedAt: customer.wholesaleAccount.reviewedAt,
            reviewedBy: customer.wholesaleAccount.reviewedBy,
          }
        : null,
      stats: {
        orders: orderAgg._count._all,
        quotes: quotes.length,
        invoices: invoices.length,
        openQuotes,
        unpaidInvoices,
        lifetimeSpend: dec(orderAgg._sum.total) ?? "0",
        refundedTotal: dec(refundAgg._sum.refundAmount) ?? "0",
        refundedOrders: refundAgg._count._all,
      },
      addresses: customer.addresses.map(serializeAddress),
      recentOrders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        total: dec(o.total),
        currency: o.currency,
        placedAt: o.createdAt,
        carrier: o.carrier,
        trackingNumber: o.trackingNumber,
      })),
      recentQuotes: quotes.map((q) => ({
        id: q.id,
        quoteNumber: q.quoteNumber,
        status: q.status,
        total: dec(q.total),
        currency: q.currency,
        createdAt: q.createdAt,
        validUntil: q.validUntil,
      })),
      recentInvoices: invoices.map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        status: i.status,
        total: dec(i.total),
        currency: i.currency,
        issueDate: i.issueDate,
        dueDate: i.dueDate,
      })),
    },
  });
}
