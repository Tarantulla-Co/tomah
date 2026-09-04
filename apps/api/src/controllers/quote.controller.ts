import type { Request, Response } from "express";
import { prisma, Prisma } from "@tomah/db";
import { HttpError } from "../lib/http-error.js";
import { writeAudit } from "../lib/audit.js";
import { accountUnlocksWholesale } from "../lib/wholesale.js";
import { nextInvoiceNumber, nextQuoteNumber } from "../lib/numbering.js";
import { lineTotal, rollup } from "../lib/money.js";
import { env } from "../config/env.js";
import type {
  ConvertQuoteInput,
  CreateQuoteInput,
  ListQuotesQuery,
  QuoteLineItemInput,
  UpdateQuoteInput,
} from "../validators/quote.schema.js";

/* ------------------------------ serialization ---------------------------- */

type Decimalish = Prisma.Decimal | null;
const dec = (v: Decimalish) => (v == null ? null : v.toString());

const WITH = {
  include: {
    customer: {
      select: {
        id: true, firstName: true, lastName: true, email: true, phone: true, companyName: true,
        wholesaleAccount: { select: { status: true } },
      },
    },
    createdBy: { select: { id: true, name: true } },
    lineItems: { orderBy: { position: "asc" } },
    invoice: { select: { id: true, invoiceNumber: true, status: true } },
  },
} satisfies Prisma.QuoteDefaultArgs;

type QuoteRow = Prisma.QuoteGetPayload<typeof WITH>;

function serialize(q: QuoteRow) {
  const now = Date.now();
  return {
    id: q.id,
    quoteNumber: q.quoteNumber,
    status: q.status,
    isExpired:
      q.status === "SENT" && q.validUntil != null && q.validUntil.getTime() < now,
    customer: {
      id: q.customer.id,
      name: `${q.customer.firstName} ${q.customer.lastName}`.trim(),
      email: q.customer.email,
      phone: q.customer.phone,
      companyName: q.customer.companyName,
      wholesaleApproved: accountUnlocksWholesale(q.customer.wholesaleAccount),
    },
    createdBy: q.createdBy ? { id: q.createdBy.id, name: q.createdBy.name } : null,
    requestNote: q.requestNote,
    internalNote: q.internalNote,
    currency: q.currency,
    subtotal: dec(q.subtotal),
    taxAmount: dec(q.taxAmount),
    discountAmount: dec(q.discountAmount),
    total: dec(q.total),
    validUntil: q.validUntil,
    sentAt: q.sentAt,
    approvedAt: q.approvedAt,
    rejectedAt: q.rejectedAt,
    rejectionReason: q.rejectionReason,
    lineItems: q.lineItems.map((li) => ({
      id: li.id,
      productId: li.productId,
      variantId: li.variantId,
      description: li.description,
      quantity: li.quantity,
      unitPrice: dec(li.unitPrice),
      lineTotal: dec(li.lineTotal),
      notes: li.notes,
      position: li.position,
    })),
    invoice: q.invoice,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
  };
}

/* -------------------------------- helpers ------------------------------- */

const EDITABLE: Prisma.QuoteGetPayload<object>["status"][] = ["REQUESTED", "DRAFT"];

async function getOr404(id: string): Promise<QuoteRow> {
  const row = await prisma.quote.findUnique({ where: { id }, ...WITH });
  if (!row) throw HttpError.notFound("Quote not found");
  return row;
}

function assertEditable(q: { status: string }) {
  if (!EDITABLE.includes(q.status as QuoteRow["status"])) {
    throw HttpError.conflict(`A ${q.status.toLowerCase()} quote can no longer be edited`);
  }
}

type Tx = Prisma.TransactionClient;

/** Resolve the create payload's customer target to an id, upserting by email. */
async function resolveCustomerId(
  tx: Tx,
  target: CreateQuoteInput["customer"],
): Promise<string> {
  if (target.customerId) {
    const found = await tx.customer.findUnique({ where: { id: target.customerId }, select: { id: true } });
    if (!found) throw HttpError.notFound("Customer not found");
    return found.id;
  }
  const customer = await tx.customer.upsert({
    where: { email: target.email! },
    update: {
      firstName: target.firstName!,
      lastName: target.lastName!,
      ...(target.phone !== undefined ? { phone: target.phone ?? null } : {}),
    },
    create: {
      type: "WHOLESALE",
      email: target.email!,
      firstName: target.firstName!,
      lastName: target.lastName!,
      phone: target.phone ?? null,
    },
    select: { id: true },
  });
  return customer.id;
}

/** Recompute subtotal / total from the persisted line items + header tax/discount. */
async function recalcTotals(tx: Tx, quoteId: string): Promise<void> {
  const quote = await tx.quote.findUniqueOrThrow({
    where: { id: quoteId },
    select: { taxAmount: true, discountAmount: true, lineItems: { select: { lineTotal: true } } },
  });
  const totals = rollup(quote.lineItems, {
    taxAmount: quote.taxAmount,
    discountAmount: quote.discountAmount,
  });
  await tx.quote.update({
    where: { id: quoteId },
    data: { subtotal: totals.subtotal, total: totals.total },
  });
}

function priceLine(input: QuoteLineItemInput, index: number): Prisma.QuoteLineItemCreateWithoutQuoteInput {
  const unit = input.unitPrice ?? null;
  return {
    ...(input.productId ? { product: { connect: { id: input.productId } } } : {}),
    ...(input.variantId ? { variant: { connect: { id: input.variantId } } } : {}),
    description: input.description,
    quantity: input.quantity,
    unitPrice: unit,
    lineTotal: unit == null ? null : lineTotal(unit, input.quantity),
    notes: input.notes ?? null,
    position: input.position ?? index,
  };
}

/* --------------------------------- list -------------------------------- */

export async function listQuotes(req: Request, res: Response) {
  const q = req.query as unknown as ListQuotesQuery;

  const where: Prisma.QuoteWhereInput = {};
  if (q.status) where.status = q.status;
  if (q.q) {
    where.OR = [
      { quoteNumber: { contains: q.q, mode: "insensitive" } },
      { customer: { firstName: { contains: q.q, mode: "insensitive" } } },
      { customer: { lastName: { contains: q.q, mode: "insensitive" } } },
      { customer: { email: { contains: q.q, mode: "insensitive" } } },
      { customer: { companyName: { contains: q.q, mode: "insensitive" } } },
    ];
  }

  const orderBy: Prisma.QuoteOrderByWithRelationInput =
    q.sort === "createdAt"
      ? { createdAt: "asc" }
      : q.sort === "quoteNumber"
        ? { quoteNumber: "asc" }
        : q.sort === "-quoteNumber"
          ? { quoteNumber: "desc" }
          : { createdAt: "desc" };

  const [total, rows, groups] = await Promise.all([
    prisma.quote.count({ where }),
    prisma.quote.findMany({
      where,
      orderBy,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      ...WITH,
    }),
    prisma.quote.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const statusCounts = Object.fromEntries(
    ["REQUESTED", "DRAFT", "SENT", "APPROVED", "REJECTED", "EXPIRED", "CONVERTED"].map((s) => [s, 0]),
  ) as Record<string, number>;
  for (const g of groups) statusCounts[g.status] = g._count._all;

  res.json({
    data: rows.map(serialize),
    pagination: { page: q.page, pageSize: q.pageSize, total, pageCount: Math.ceil(total / q.pageSize) },
    statusCounts,
  });
}

/* --------------------------------- detail ------------------------------ */

export async function getQuote(req: Request, res: Response) {
  const quote = await getOr404(req.params.id!);
  const auditTrail = await prisma.auditLog.findMany({
    where: { entityType: "Quote", entityId: quote.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { actor: { select: { name: true } } },
  });

  res.json({
    data: {
      ...serialize(quote),
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

/* --------------------------------- create ------------------------------ */

export async function createQuote(
  req: Request<unknown, unknown, CreateQuoteInput>,
  res: Response,
) {
  const b = req.body;

  const quote = await prisma.$transaction(async (tx) => {
    const customerId = await resolveCustomerId(tx, b.customer);
    const quoteNumber = await nextQuoteNumber();

    const created = await tx.quote.create({
      data: {
        quoteNumber,
        customerId,
        status: "DRAFT",
        createdById: req.auth?.userId ?? null,
        requestNote: b.requestNote ?? null,
        internalNote: b.internalNote ?? null,
        currency: b.currency,
        validUntil: b.validUntil ?? null,
        taxAmount: b.taxAmount ?? null,
        discountAmount: b.discountAmount ?? null,
        lineItems: { create: b.lineItems.map(priceLine) },
      },
      select: { id: true },
    });
    await recalcTotals(tx, created.id);
    return tx.quote.findUniqueOrThrow({ where: { id: created.id }, ...WITH });
  });

  await writeAudit({
    actorId: req.auth?.userId,
    action: "quote.created",
    entityType: "Quote",
    entityId: quote.id,
    summary: `${req.auth?.name} created quote ${quote.quoteNumber}`,
    metadata: { lineItems: quote.lineItems.length },
  });

  res.status(201).json({ data: serialize(quote) });
}

/* --------------------------------- update ------------------------------ */

export async function updateQuote(
  req: Request<{ id: string }, unknown, UpdateQuoteInput>,
  res: Response,
) {
  const quote = await getOr404(req.params.id);
  assertEditable(quote);
  const b = req.body;

  const data: Prisma.QuoteUpdateInput = {};
  if (b.requestNote !== undefined) data.requestNote = b.requestNote ?? null;
  if (b.internalNote !== undefined) data.internalNote = b.internalNote ?? null;
  if (b.currency !== undefined) data.currency = b.currency;
  if (b.validUntil !== undefined) data.validUntil = b.validUntil ?? null;
  if (b.taxAmount !== undefined) data.taxAmount = b.taxAmount ?? null;
  if (b.discountAmount !== undefined) data.discountAmount = b.discountAmount ?? null;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.quote.update({ where: { id: quote.id }, data });
    await recalcTotals(tx, quote.id);
    return tx.quote.findUniqueOrThrow({ where: { id: quote.id }, ...WITH });
  });

  await writeAudit({
    actorId: req.auth?.userId,
    action: "quote.updated",
    entityType: "Quote",
    entityId: quote.id,
    summary: `${req.auth?.name} updated quote ${quote.quoteNumber}`,
    metadata: { fields: Object.keys(data) },
  });

  res.json({ data: serialize(updated) });
}

/* ------------------------------- line items ---------------------------- */

export async function addLineItem(req: Request<{ id: string }>, res: Response) {
  const quote = await getOr404(req.params.id);
  assertEditable(quote);
  const body = req.body as QuoteLineItemInput;

  const updated = await prisma.$transaction(async (tx) => {
    const count = await tx.quoteLineItem.count({ where: { quoteId: quote.id } });
    await tx.quote.update({
      where: { id: quote.id },
      data: { lineItems: { create: priceLine(body, count) } },
    });
    await recalcTotals(tx, quote.id);
    return tx.quote.findUniqueOrThrow({ where: { id: quote.id }, ...WITH });
  });

  await writeAudit({
    actorId: req.auth?.userId,
    action: "quote.line_added",
    entityType: "Quote",
    entityId: quote.id,
    summary: `Added "${body.description}" to ${quote.quoteNumber}`,
  });

  res.status(201).json({ data: serialize(updated) });
}

export async function updateLineItem(
  req: Request<{ id: string; lineId: string }>,
  res: Response,
) {
  const quote = await getOr404(req.params.id);
  assertEditable(quote);
  const line = await prisma.quoteLineItem.findFirst({
    where: { id: req.params.lineId, quoteId: quote.id },
  });
  if (!line) throw HttpError.notFound("Line item not found on this quote");

  const b = req.body as Partial<QuoteLineItemInput>;
  const quantity = b.quantity ?? line.quantity;
  const unitPrice =
    b.unitPrice === undefined ? line.unitPrice : b.unitPrice == null ? null : b.unitPrice;

  const data: Prisma.QuoteLineItemUpdateInput = {
    quantity,
    unitPrice,
    lineTotal: unitPrice == null ? null : lineTotal(unitPrice, quantity),
  };
  if (b.productId !== undefined) data.product = b.productId ? { connect: { id: b.productId } } : { disconnect: true };
  if (b.variantId !== undefined) data.variant = b.variantId ? { connect: { id: b.variantId } } : { disconnect: true };
  if (b.description !== undefined) data.description = b.description;
  if (b.notes !== undefined) data.notes = b.notes ?? null;
  if (b.position !== undefined) data.position = b.position;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.quoteLineItem.update({ where: { id: line.id }, data });
    await recalcTotals(tx, quote.id);
    return tx.quote.findUniqueOrThrow({ where: { id: quote.id }, ...WITH });
  });

  res.json({ data: serialize(updated) });
}

export async function deleteLineItem(
  req: Request<{ id: string; lineId: string }>,
  res: Response,
) {
  const quote = await getOr404(req.params.id);
  assertEditable(quote);
  const line = await prisma.quoteLineItem.findFirst({
    where: { id: req.params.lineId, quoteId: quote.id },
  });
  if (!line) throw HttpError.notFound("Line item not found on this quote");

  const updated = await prisma.$transaction(async (tx) => {
    await tx.quoteLineItem.delete({ where: { id: line.id } });
    await recalcTotals(tx, quote.id);
    return tx.quote.findUniqueOrThrow({ where: { id: quote.id }, ...WITH });
  });

  res.json({ data: serialize(updated) });
}

/* --------------------------- status transitions ----------------------- */

export async function sendQuote(req: Request<{ id: string }>, res: Response) {
  const quote = await getOr404(req.params.id);
  if (!["REQUESTED", "DRAFT"].includes(quote.status)) {
    throw HttpError.conflict(`Cannot send a ${quote.status.toLowerCase()} quote`);
  }
  if (quote.lineItems.length === 0) throw HttpError.badRequest("Add at least one line item first");
  const unpriced = quote.lineItems.filter((li) => li.unitPrice == null);
  if (unpriced.length > 0) {
    throw HttpError.badRequest(`Price every line item before sending (${unpriced.length} unpriced)`);
  }

  const b = req.body as { validUntil?: Date | null; internalNote?: string | null };
  const updated = await prisma.$transaction(async (tx) => {
    await recalcTotals(tx, quote.id);
    await tx.quote.update({
      where: { id: quote.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        validUntil: b.validUntil !== undefined ? b.validUntil ?? null : quote.validUntil,
        ...(b.internalNote !== undefined ? { internalNote: b.internalNote ?? null } : {}),
      },
    });
    return tx.quote.findUniqueOrThrow({ where: { id: quote.id }, ...WITH });
  });

  await writeAudit({
    actorId: req.auth?.userId,
    action: "quote.sent",
    entityType: "Quote",
    entityId: quote.id,
    summary: `${req.auth?.name} sent quote ${quote.quoteNumber} (${dec(updated.total)} ${updated.currency})`,
    metadata: { total: dec(updated.total), validUntil: updated.validUntil },
  });

  res.json({ data: serialize(updated) });
}

export async function approveQuote(req: Request<{ id: string }>, res: Response) {
  const quote = await getOr404(req.params.id);
  if (quote.status !== "SENT") {
    throw HttpError.conflict(`Only a sent quote can be approved (this one is ${quote.status.toLowerCase()})`);
  }
  const note: string | null = req.body?.note ?? null;
  const updated = await prisma.quote.update({
    where: { id: quote.id },
    data: { status: "APPROVED", approvedAt: new Date(), rejectedAt: null, rejectionReason: null },
    ...WITH,
  });

  await writeAudit({
    actorId: req.auth?.userId,
    action: "quote.approved",
    entityType: "Quote",
    entityId: quote.id,
    summary: `${req.auth?.name} recorded customer approval of ${quote.quoteNumber}`,
    metadata: { note },
  });

  res.json({ data: serialize(updated) });
}

export async function rejectQuote(req: Request<{ id: string }>, res: Response) {
  const quote = await getOr404(req.params.id);
  if (["CONVERTED", "REJECTED"].includes(quote.status)) {
    throw HttpError.conflict(`Cannot reject a ${quote.status.toLowerCase()} quote`);
  }
  const { rejectionReason } = req.body as { rejectionReason: string };
  const updated = await prisma.quote.update({
    where: { id: quote.id },
    data: { status: "REJECTED", rejectedAt: new Date(), rejectionReason },
    ...WITH,
  });

  await writeAudit({
    actorId: req.auth?.userId,
    action: "quote.rejected",
    entityType: "Quote",
    entityId: quote.id,
    summary: `${req.auth?.name} marked ${quote.quoteNumber} rejected`,
    metadata: { from: quote.status, rejectionReason },
  });

  res.json({ data: serialize(updated) });
}

/* ---------------------------- quote -> invoice ------------------------- */

export async function convertQuote(
  req: Request<{ id: string }, unknown, ConvertQuoteInput>,
  res: Response,
) {
  const quote = await getOr404(req.params.id);
  if (quote.status !== "APPROVED") {
    throw HttpError.conflict("Only an approved quote can be converted to an invoice");
  }
  if (quote.invoice) {
    throw HttpError.conflict(`Quote ${quote.quoteNumber} is already invoiced (${quote.invoice.invoiceNumber})`);
  }
  const b = req.body;

  const result = await prisma.$transaction(async (tx) => {
    const totals = rollup(quote.lineItems, {
      taxAmount: quote.taxAmount,
      discountAmount: quote.discountAmount,
    });
    const issueDate = new Date();
    const dueDate =
      b.dueDate ?? new Date(issueDate.getTime() + env.INVOICE_DUE_DAYS * 86_400_000);
    const invoiceNumber = await nextInvoiceNumber();

    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        customerId: quote.customer.id,
        quoteId: quote.id,
        status: "DRAFT",
        currency: quote.currency,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        discountAmount: totals.discountAmount,
        total: totals.total,
        issueDate,
        dueDate,
        notes: b.notes ?? null,
        lineItems: {
          create: quote.lineItems.map((li, i) => ({
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice ?? 0,
            lineTotal: li.lineTotal ?? 0,
            position: li.position ?? i,
          })),
        },
      },
      select: { id: true, invoiceNumber: true },
    });

    await tx.quote.update({ where: { id: quote.id }, data: { status: "CONVERTED" } });
    return invoice;
  });

  await writeAudit({
    actorId: req.auth?.userId,
    action: "quote.converted",
    entityType: "Quote",
    entityId: quote.id,
    summary: `${req.auth?.name} converted ${quote.quoteNumber} → invoice ${result.invoiceNumber}`,
    metadata: { invoiceId: result.id, invoiceNumber: result.invoiceNumber },
  });
  await writeAudit({
    actorId: req.auth?.userId,
    action: "invoice.created",
    entityType: "Invoice",
    entityId: result.id,
    summary: `Invoice ${result.invoiceNumber} created from quote ${quote.quoteNumber}`,
    metadata: { quoteId: quote.id, quoteNumber: quote.quoteNumber },
  });

  const [fresh, invoice] = await Promise.all([
    getOr404(quote.id),
    prisma.invoice.findUniqueOrThrow({
      where: { id: result.id },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, email: true } },
        lineItems: { orderBy: { position: "asc" } },
      },
    }),
  ]);

  res.status(201).json({
    data: {
      quote: serialize(fresh),
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        total: dec(invoice.total),
        currency: invoice.currency,
      },
    },
  });
}
