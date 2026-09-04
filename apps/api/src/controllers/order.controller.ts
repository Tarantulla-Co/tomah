import type { Request, Response } from "express";
import { prisma, Prisma } from "@tomah/db";
import { HttpError } from "../lib/http-error.js";
import { writeAudit } from "../lib/audit.js";
import { toDec } from "../lib/money.js";
import type {
  ListOrdersQuery,
  RefundOrderInput,
  ShipOrderInput,
  UpdateOrderInput,
} from "../validators/order.schema.js";

/* ------------------------------ serialization ---------------------------- */

type Decimalish = Prisma.Decimal | null;
const dec = (v: Decimalish) => (v == null ? null : v.toString());

const WITH = {
  include: {
    customer: {
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, type: true },
    },
    shippingAddress: true,
    billingAddress: true,
    items: { orderBy: { sku: "asc" } },
  },
} satisfies Prisma.OrderDefaultArgs;

type OrderRow = Prisma.OrderGetPayload<typeof WITH>;

function serializeAddress(a: OrderRow["shippingAddress"]) {
  if (!a) return null;
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
  };
}

/** Chronological event list — the canonical shape the storefront renders as an
 *  order-tracking timeline (see docs/API.md, Phase 5). */
function buildTimeline(o: OrderRow) {
  const events: Array<{ status: string; at: Date }> = [{ status: "PLACED", at: o.createdAt }];
  if (o.paidAt) events.push({ status: "PAID", at: o.paidAt });
  if (o.processingAt) events.push({ status: "PROCESSING", at: o.processingAt });
  if (o.shippedAt) events.push({ status: "SHIPPED", at: o.shippedAt });
  if (o.deliveredAt) events.push({ status: "DELIVERED", at: o.deliveredAt });
  if (o.cancelledAt) events.push({ status: "CANCELLED", at: o.cancelledAt });
  if (o.refundedAt) events.push({ status: "REFUNDED", at: o.refundedAt });
  return events.sort((a, b) => a.at.getTime() - b.at.getTime());
}

function serialize(o: OrderRow) {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    customer: {
      id: o.customer.id,
      name: `${o.customer.firstName} ${o.customer.lastName}`.trim(),
      email: o.customer.email,
      phone: o.customer.phone,
      type: o.customer.type,
    },
    currency: o.currency,
    amounts: {
      subtotal: dec(o.subtotal),
      shippingFee: dec(o.shippingFee),
      taxAmount: dec(o.taxAmount),
      discountAmount: dec(o.discountAmount),
      total: dec(o.total),
    },
    payment: {
      provider: o.paymentProvider,
      reference: o.paymentReference,
      paidAt: o.paidAt,
    },
    shipping: {
      carrier: o.carrier,
      trackingNumber: o.trackingNumber,
      processingAt: o.processingAt,
      shippedAt: o.shippedAt,
      deliveredAt: o.deliveredAt,
    },
    addresses: {
      shipping: serializeAddress(o.shippingAddress),
      billing: serializeAddress(o.billingAddress),
    },
    customerNote: o.customerNote,
    internalNote: o.internalNote,
    cancellation: o.cancelledAt ? { cancelledAt: o.cancelledAt, reason: o.cancelReason } : null,
    refund: o.refundedAt
      ? { refundedAt: o.refundedAt, amount: dec(o.refundAmount), reason: o.refundReason }
      : null,
    items: o.items.map((it) => ({
      id: it.id,
      productId: it.productId,
      variantId: it.variantId,
      sku: it.sku,
      name: it.name,
      unitPrice: dec(it.unitPrice),
      quantity: it.quantity,
      lineTotal: dec(it.lineTotal),
    })),
    timeline: buildTimeline(o),
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

/* -------------------------------- helpers ------------------------------- */

async function getOr404(id: string): Promise<OrderRow> {
  const row = await prisma.order.findUnique({ where: { id }, ...WITH });
  if (!row) throw HttpError.notFound("Order not found");
  return row;
}

function assertStatus(o: { status: string }, allowed: OrderRow["status"][], verb: string) {
  if (!allowed.includes(o.status as OrderRow["status"])) {
    throw HttpError.conflict(`Cannot ${verb} a ${o.status.toLowerCase()} order`);
  }
}

/* --------------------------------- list -------------------------------- */

export async function listOrders(req: Request, res: Response) {
  const q = req.query as unknown as ListOrdersQuery;

  // PENDING_PAYMENT orders are storefront carts that never completed payment —
  // not real sales. They are excluded from the admin queue (and statusCounts
  // below); the storefront owns that state until its webhook flips it to PAID.
  const where: Prisma.OrderWhereInput = { status: { not: "PENDING_PAYMENT" } };
  if (q.status) where.status = q.status;
  if (q.carrier) where.carrier = q.carrier;
  if (q.q) {
    where.OR = [
      { orderNumber: { contains: q.q, mode: "insensitive" } },
      { trackingNumber: { contains: q.q, mode: "insensitive" } },
      { customer: { firstName: { contains: q.q, mode: "insensitive" } } },
      { customer: { lastName: { contains: q.q, mode: "insensitive" } } },
      { customer: { email: { contains: q.q, mode: "insensitive" } } },
    ];
  }

  const dir = q.sort.startsWith("-") ? "desc" : "asc";
  const field = q.sort.replace(/^-/, "") as "createdAt" | "total" | "orderNumber";
  const orderBy: Prisma.OrderOrderByWithRelationInput = { [field]: dir };

  const [total, rows, groups] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      ...WITH,
    }),
    prisma.order.groupBy({
      by: ["status"],
      where: { status: { not: "PENDING_PAYMENT" } },
      _count: { _all: true },
    }),
  ]);

  const statusCounts = Object.fromEntries(
    ["PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"].map((s) => [s, 0]),
  ) as Record<string, number>;
  for (const g of groups) statusCounts[g.status] = g._count._all;

  res.json({
    data: rows.map(serialize),
    pagination: { page: q.page, pageSize: q.pageSize, total, pageCount: Math.ceil(total / q.pageSize) },
    statusCounts,
  });
}

/* --------------------------------- detail ------------------------------ */

export async function getOrder(req: Request, res: Response) {
  const order = await getOr404(req.params.id!);
  const auditTrail = await prisma.auditLog.findMany({
    where: { entityType: "Order", entityId: order.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { actor: { select: { name: true } } },
  });

  res.json({
    data: {
      ...serialize(order),
      auditTrail: auditTrail.map((e) => ({
        id: e.id,
        action: e.action,
        summary: e.summary,
        actor: e.actor?.name ?? "System",
        at: e.createdAt,
        metadata: e.metadata,
      })),
    },
  });
}

/* ---------------------------- edit shipment --------------------------- */

export async function updateOrder(
  req: Request<{ id: string }, unknown, UpdateOrderInput>,
  res: Response,
) {
  const order = await getOr404(req.params.id);
  if (["CANCELLED", "REFUNDED"].includes(order.status)) {
    throw HttpError.conflict(`A ${order.status.toLowerCase()} order can no longer be edited`);
  }
  const b = req.body;
  const data: Prisma.OrderUpdateInput = {};
  if (b.carrier !== undefined) data.carrier = b.carrier ?? null;
  if (b.trackingNumber !== undefined) data.trackingNumber = b.trackingNumber ?? null;
  if (b.internalNote !== undefined) data.internalNote = b.internalNote ?? null;

  const updated = await prisma.order.update({ where: { id: order.id }, data, ...WITH });
  await writeAudit({
    actorId: req.auth?.userId,
    action: "order.updated",
    entityType: "Order",
    entityId: order.id,
    summary: `${req.auth?.name} updated ${order.orderNumber}`,
    metadata: { fields: Object.keys(data) },
  });
  res.json({ data: serialize(updated) });
}

/* --------------------------- status transitions --------------------- */

export async function processOrder(req: Request<{ id: string }>, res: Response) {
  const order = await getOr404(req.params.id);
  assertStatus(order, ["PAID"], "start processing");
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status: "PROCESSING", processingAt: new Date() },
    ...WITH,
  });
  await writeAudit({
    actorId: req.auth?.userId,
    action: "order.processing",
    entityType: "Order",
    entityId: order.id,
    summary: `${req.auth?.name} moved ${order.orderNumber} to processing`,
    metadata: { from: order.status },
  });
  res.json({ data: serialize(updated) });
}

export async function shipOrder(
  req: Request<{ id: string }, unknown, ShipOrderInput>,
  res: Response,
) {
  const order = await getOr404(req.params.id);
  assertStatus(order, ["PAID", "PROCESSING"], "ship");
  const b = req.body;
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "SHIPPED",
      carrier: b.carrier,
      trackingNumber: b.trackingNumber,
      shippedAt: b.shippedAt ?? new Date(),
      processingAt: order.processingAt ?? new Date(),
    },
    ...WITH,
  });
  await writeAudit({
    actorId: req.auth?.userId,
    action: "order.shipped",
    entityType: "Order",
    entityId: order.id,
    summary: `${req.auth?.name} shipped ${order.orderNumber} via ${b.carrier} (${b.trackingNumber})`,
    metadata: { from: order.status, carrier: b.carrier, trackingNumber: b.trackingNumber },
  });
  res.json({ data: serialize(updated) });
}

export async function deliverOrder(req: Request<{ id: string }>, res: Response) {
  const order = await getOr404(req.params.id);
  assertStatus(order, ["SHIPPED"], "mark delivered");
  const deliveredAt: Date = req.body?.deliveredAt ?? new Date();
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status: "DELIVERED", deliveredAt },
    ...WITH,
  });
  await writeAudit({
    actorId: req.auth?.userId,
    action: "order.delivered",
    entityType: "Order",
    entityId: order.id,
    summary: `${req.auth?.name} marked ${order.orderNumber} delivered`,
    metadata: { from: order.status },
  });
  res.json({ data: serialize(updated) });
}

export async function cancelOrder(req: Request<{ id: string }>, res: Response) {
  const order = await getOr404(req.params.id);
  assertStatus(order, ["PAID", "PROCESSING"], "cancel");
  const { reason } = req.body as { reason: string };
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason },
    ...WITH,
  });
  await writeAudit({
    actorId: req.auth?.userId,
    action: "order.cancelled",
    entityType: "Order",
    entityId: order.id,
    summary: `${req.auth?.name} cancelled ${order.orderNumber}`,
    metadata: { from: order.status, reason },
  });
  res.json({ data: serialize(updated) });
}

export async function refundOrder(
  req: Request<{ id: string }, unknown, RefundOrderInput>,
  res: Response,
) {
  const order = await getOr404(req.params.id);
  assertStatus(order, ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"], "refund");
  const { amount, reason } = req.body;

  const requested = amount == null ? toDec(order.total) : toDec(amount);
  if (requested.lessThanOrEqualTo(0)) throw HttpError.badRequest("Refund amount must be positive");
  if (requested.greaterThan(toDec(order.total))) {
    throw HttpError.badRequest("Refund amount exceeds the order total");
  }
  const isPartial = requested.lessThan(toDec(order.total));

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "REFUNDED",
      refundedAt: new Date(),
      refundAmount: requested,
      refundReason: reason,
    },
    ...WITH,
  });
  await writeAudit({
    actorId: req.auth?.userId,
    action: "order.refunded",
    entityType: "Order",
    entityId: order.id,
    summary: `${req.auth?.name} refunded ${dec(updated.refundAmount)} ${order.currency} on ${order.orderNumber}${isPartial ? " (partial)" : ""}`,
    metadata: { from: order.status, amount: dec(requested), partial: isPartial, reason },
  });
  res.json({ data: serialize(updated) });
}
