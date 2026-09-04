import type { Request, Response } from "express";
import { prisma, Prisma } from "@tomah/db";
import { HttpError } from "../lib/http-error.js";
import { writeAudit } from "../lib/audit.js";
import { nextInvoiceNumber } from "../lib/numbering.js";
import { lineTotal, rollup } from "../lib/money.js";
import { syncInvoiceToAccounting } from "../lib/accounting/sync.js";
import { payments } from "../lib/payments/index.js";
import { env } from "../config/env.js";
import type {
  CreateInvoiceInput,
  InvoiceLineItemInput,
  ListInvoicesQuery,
  RecordPaymentInput,
  UpdateInvoiceInput,
} from "../validators/invoice.schema.js";

/* ------------------------------ serialization ---------------------------- */

type Decimalish = Prisma.Decimal | null;
const dec = (v: Decimalish) => (v == null ? null : v.toString());

const WITH = {
  include: {
    customer: {
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, companyName: true },
    },
    quote: { select: { id: true, quoteNumber: true, status: true } },
    lineItems: { orderBy: { position: "asc" } },
  },
} satisfies Prisma.InvoiceDefaultArgs;

type InvoiceRow = Prisma.InvoiceGetPayload<typeof WITH>;

function serialize(inv: InvoiceRow) {
  const now = Date.now();
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    isOverdue:
      (inv.status === "SENT" || inv.status === "OVERDUE") &&
      inv.dueDate != null &&
      inv.dueDate.getTime() < now,
    customer: {
      id: inv.customer.id,
      name: `${inv.customer.firstName} ${inv.customer.lastName}`.trim(),
      email: inv.customer.email,
      phone: inv.customer.phone,
      companyName: inv.customer.companyName,
    },
    quote: inv.quote,
    currency: inv.currency,
    subtotal: dec(inv.subtotal),
    taxAmount: dec(inv.taxAmount),
    discountAmount: dec(inv.discountAmount),
    total: dec(inv.total),
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    sentAt: inv.sentAt,
    paidAt: inv.paidAt,
    payment: {
      provider: inv.paymentProvider,
      reference: inv.paymentReference,
      online: payments.online,
    },
    accounting: {
      status: inv.accountingSyncStatus,
      adapter: inv.accountingAdapter,
      ref: inv.accountingRef,
      syncedAt: inv.accountingSyncedAt,
      error: inv.accountingError,
    },
    notes: inv.notes,
    lineItems: inv.lineItems.map((li) => ({
      id: li.id,
      description: li.description,
      quantity: li.quantity,
      unitPrice: dec(li.unitPrice),
      lineTotal: dec(li.lineTotal),
      position: li.position,
    })),
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt,
  };
}

/* -------------------------------- helpers ------------------------------- */

async function getOr404(id: string): Promise<InvoiceRow> {
  const row = await prisma.invoice.findUnique({ where: { id }, ...WITH });
  if (!row) throw HttpError.notFound("Invoice not found");
  return row;
}

function assertDraft(inv: { status: string }) {
  if (inv.status !== "DRAFT") {
    throw HttpError.conflict(`A ${inv.status.toLowerCase()} invoice can no longer be edited`);
  }
}

type Tx = Prisma.TransactionClient;

async function resolveCustomerId(tx: Tx, target: CreateInvoiceInput["customer"]): Promise<string> {
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

async function recalcTotals(tx: Tx, invoiceId: string): Promise<void> {
  const inv = await tx.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: { taxAmount: true, discountAmount: true, lineItems: { select: { lineTotal: true } } },
  });
  const totals = rollup(inv.lineItems, { taxAmount: inv.taxAmount, discountAmount: inv.discountAmount });
  await tx.invoice.update({
    where: { id: invoiceId },
    data: { subtotal: totals.subtotal, total: totals.total },
  });
}

function buildLine(input: InvoiceLineItemInput, index: number) {
  return {
    description: input.description,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    lineTotal: lineTotal(input.unitPrice, input.quantity),
    position: input.position ?? index,
  };
}

/* --------------------------------- list -------------------------------- */

export async function listInvoices(req: Request, res: Response) {
  const q = req.query as unknown as ListInvoicesQuery;

  const where: Prisma.InvoiceWhereInput = {};
  if (q.status) where.status = q.status;
  if (q.q) {
    where.OR = [
      { invoiceNumber: { contains: q.q, mode: "insensitive" } },
      { quote: { quoteNumber: { contains: q.q, mode: "insensitive" } } },
      { customer: { firstName: { contains: q.q, mode: "insensitive" } } },
      { customer: { lastName: { contains: q.q, mode: "insensitive" } } },
      { customer: { email: { contains: q.q, mode: "insensitive" } } },
      { customer: { companyName: { contains: q.q, mode: "insensitive" } } },
    ];
  }

  const dir = q.sort.startsWith("-") ? "desc" : "asc";
  const field = q.sort.replace(/^-/, "") as "createdAt" | "dueDate" | "total";
  const orderBy: Prisma.InvoiceOrderByWithRelationInput = { [field]: dir };

  const [total, rows, groups] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      orderBy,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      ...WITH,
    }),
    prisma.invoice.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const statusCounts = Object.fromEntries(
    ["DRAFT", "SENT", "PAID", "OVERDUE", "VOID"].map((s) => [s, 0]),
  ) as Record<string, number>;
  for (const g of groups) statusCounts[g.status] = g._count._all;

  res.json({
    data: rows.map(serialize),
    pagination: { page: q.page, pageSize: q.pageSize, total, pageCount: Math.ceil(total / q.pageSize) },
    statusCounts,
  });
}

/* --------------------------------- detail ------------------------------ */

export async function getInvoice(req: Request, res: Response) {
  const invoice = await getOr404(req.params.id!);
  const auditTrail = await prisma.auditLog.findMany({
    where: { entityType: "Invoice", entityId: invoice.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { actor: { select: { name: true } } },
  });

  res.json({
    data: {
      ...serialize(invoice),
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

/* --------------------------- create (standalone) --------------------- */

export async function createInvoice(
  req: Request<unknown, unknown, CreateInvoiceInput>,
  res: Response,
) {
  const b = req.body;

  const invoice = await prisma.$transaction(async (tx) => {
    const customerId = await resolveCustomerId(tx, b.customer);
    const invoiceNumber = await nextInvoiceNumber();
    const issueDate = new Date();
    const dueDate = b.dueDate ?? new Date(issueDate.getTime() + env.INVOICE_DUE_DAYS * 86_400_000);

    const created = await tx.invoice.create({
      data: {
        invoiceNumber,
        customerId,
        status: "DRAFT",
        currency: b.currency,
        taxAmount: b.taxAmount ?? 0,
        discountAmount: b.discountAmount ?? 0,
        subtotal: 0,
        total: 0,
        issueDate,
        dueDate,
        notes: b.notes ?? null,
        lineItems: { create: b.lineItems.map(buildLine) },
      },
      select: { id: true },
    });
    await recalcTotals(tx, created.id);
    return tx.invoice.findUniqueOrThrow({ where: { id: created.id }, ...WITH });
  });

  await writeAudit({
    actorId: req.auth?.userId,
    action: "invoice.created",
    entityType: "Invoice",
    entityId: invoice.id,
    summary: `${req.auth?.name} created invoice ${invoice.invoiceNumber}`,
    metadata: { standalone: true, lineItems: invoice.lineItems.length },
  });

  res.status(201).json({ data: serialize(invoice) });
}

/* --------------------------------- update ------------------------------ */

export async function updateInvoice(
  req: Request<{ id: string }, unknown, UpdateInvoiceInput>,
  res: Response,
) {
  const invoice = await getOr404(req.params.id);
  assertDraft(invoice);
  const b = req.body;

  const data: Prisma.InvoiceUpdateInput = {};
  if (b.currency !== undefined) data.currency = b.currency;
  if (b.dueDate !== undefined) data.dueDate = b.dueDate ?? null;
  if (b.notes !== undefined) data.notes = b.notes ?? null;
  if (b.taxAmount !== undefined) data.taxAmount = b.taxAmount ?? 0;
  if (b.discountAmount !== undefined) data.discountAmount = b.discountAmount ?? 0;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.invoice.update({ where: { id: invoice.id }, data });
    await recalcTotals(tx, invoice.id);
    return tx.invoice.findUniqueOrThrow({ where: { id: invoice.id }, ...WITH });
  });

  await writeAudit({
    actorId: req.auth?.userId,
    action: "invoice.updated",
    entityType: "Invoice",
    entityId: invoice.id,
    summary: `${req.auth?.name} updated invoice ${invoice.invoiceNumber}`,
    metadata: { fields: Object.keys(data) },
  });

  res.json({ data: serialize(updated) });
}

/* ------------------------------- line items ---------------------------- */

export async function addLineItem(req: Request<{ id: string }>, res: Response) {
  const invoice = await getOr404(req.params.id);
  assertDraft(invoice);
  const body = req.body as InvoiceLineItemInput;

  const updated = await prisma.$transaction(async (tx) => {
    const count = await tx.invoiceLineItem.count({ where: { invoiceId: invoice.id } });
    await tx.invoiceLineItem.create({ data: { invoiceId: invoice.id, ...buildLine(body, count) } });
    await recalcTotals(tx, invoice.id);
    return tx.invoice.findUniqueOrThrow({ where: { id: invoice.id }, ...WITH });
  });

  res.status(201).json({ data: serialize(updated) });
}

export async function updateLineItem(
  req: Request<{ id: string; lineId: string }>,
  res: Response,
) {
  const invoice = await getOr404(req.params.id);
  assertDraft(invoice);
  const line = await prisma.invoiceLineItem.findFirst({
    where: { id: req.params.lineId, invoiceId: invoice.id },
  });
  if (!line) throw HttpError.notFound("Line item not found on this invoice");

  const b = req.body as Partial<InvoiceLineItemInput>;
  const quantity = b.quantity ?? line.quantity;
  const unitPrice = b.unitPrice ?? line.unitPrice;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.invoiceLineItem.update({
      where: { id: line.id },
      data: {
        quantity,
        unitPrice,
        lineTotal: lineTotal(unitPrice, quantity),
        ...(b.description !== undefined ? { description: b.description } : {}),
        ...(b.position !== undefined ? { position: b.position } : {}),
      },
    });
    await recalcTotals(tx, invoice.id);
    return tx.invoice.findUniqueOrThrow({ where: { id: invoice.id }, ...WITH });
  });

  res.json({ data: serialize(updated) });
}

export async function deleteLineItem(
  req: Request<{ id: string; lineId: string }>,
  res: Response,
) {
  const invoice = await getOr404(req.params.id);
  assertDraft(invoice);
  const line = await prisma.invoiceLineItem.findFirst({
    where: { id: req.params.lineId, invoiceId: invoice.id },
  });
  if (!line) throw HttpError.notFound("Line item not found on this invoice");

  const updated = await prisma.$transaction(async (tx) => {
    await tx.invoiceLineItem.delete({ where: { id: line.id } });
    await recalcTotals(tx, invoice.id);
    return tx.invoice.findUniqueOrThrow({ where: { id: invoice.id }, ...WITH });
  });

  res.json({ data: serialize(updated) });
}

/* --------------------------- status transitions --------------------- */

export async function sendInvoice(req: Request<{ id: string }>, res: Response) {
  const invoice = await getOr404(req.params.id);
  if (invoice.status !== "DRAFT") {
    throw HttpError.conflict(`Cannot send a ${invoice.status.toLowerCase()} invoice`);
  }
  if (invoice.lineItems.length === 0) throw HttpError.badRequest("Add at least one line item first");

  const b = req.body as { dueDate?: Date | null };
  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: "SENT",
      sentAt: new Date(),
      dueDate: b.dueDate !== undefined ? b.dueDate ?? null : invoice.dueDate,
    },
    ...WITH,
  });

  await writeAudit({
    actorId: req.auth?.userId,
    action: "invoice.sent",
    entityType: "Invoice",
    entityId: invoice.id,
    summary: `${req.auth?.name} sent invoice ${invoice.invoiceNumber} (${dec(updated.total)} ${updated.currency})`,
    metadata: { total: dec(updated.total), dueDate: updated.dueDate },
  });

  res.json({ data: serialize(updated) });
}

export async function recordPayment(
  req: Request<{ id: string }, unknown, RecordPaymentInput>,
  res: Response,
) {
  const invoice = await getOr404(req.params.id);
  if (!["DRAFT", "SENT", "OVERDUE"].includes(invoice.status)) {
    throw HttpError.conflict(`Cannot record a payment on a ${invoice.status.toLowerCase()} invoice`);
  }
  const b = req.body;
  const paidAt = b.paidAt ?? new Date();

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: "PAID",
      paidAt,
      paymentReference: b.reference ?? invoice.paymentReference,
    },
  });

  await writeAudit({
    actorId: req.auth?.userId,
    action: "invoice.paid",
    entityType: "Invoice",
    entityId: invoice.id,
    summary: `${req.auth?.name} recorded payment for ${invoice.invoiceNumber}`,
    metadata: {
      reference: b.reference ?? null,
      amount: b.amount ?? dec(invoice.total),
      invoiceTotal: dec(invoice.total),
      note: b.note ?? null,
      provider: invoice.paymentProvider,
    },
  });

  // Best-effort accounting push (no-op unless an adapter is configured).
  await syncInvoiceToAccounting(invoice.id).catch(() => undefined);

  res.json({ data: serialize(await getOr404(invoice.id)) });
}

export async function voidInvoice(req: Request<{ id: string }>, res: Response) {
  const invoice = await getOr404(req.params.id);
  if (invoice.status === "PAID") {
    throw HttpError.conflict("A paid invoice cannot be voided");
  }
  if (invoice.status === "VOID") {
    throw HttpError.conflict("Invoice is already void");
  }
  const reason: string | null = req.body?.reason ?? null;

  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: "VOID" },
    ...WITH,
  });

  await writeAudit({
    actorId: req.auth?.userId,
    action: "invoice.voided",
    entityType: "Invoice",
    entityId: invoice.id,
    summary: `${req.auth?.name} voided invoice ${invoice.invoiceNumber}`,
    metadata: { from: invoice.status, reason },
  });

  res.json({ data: serialize(updated) });
}
