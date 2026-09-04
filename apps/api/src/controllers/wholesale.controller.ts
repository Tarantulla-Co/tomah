import type { Request, Response } from "express";
import { prisma, Prisma } from "@tomah/db";
import { HttpError } from "../lib/http-error.js";
import { writeAudit } from "../lib/audit.js";
import type {
  CreateApplicationInput,
  ListWholesaleQuery,
} from "../validators/wholesale.schema.js";

const WITH = {
  include: {
    customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, type: true } },
    reviewedBy: { select: { id: true, name: true, email: true } },
  },
} satisfies Prisma.WholesaleAccountDefaultArgs;

type AccountRow = Prisma.WholesaleAccountGetPayload<typeof WITH>;

function serialize(a: AccountRow) {
  return {
    id: a.id,
    status: a.status,
    unlocksWholesalePricing: a.status === "APPROVED",
    customer: {
      id: a.customer.id,
      name: `${a.customer.firstName} ${a.customer.lastName}`.trim(),
      email: a.customer.email,
      phone: a.customer.phone,
      type: a.customer.type,
    },
    application: {
      businessName: a.businessName,
      businessRegistrationNumber: a.businessRegistrationNumber,
      taxId: a.taxId,
      businessType: a.businessType,
      website: a.website,
      contactName: a.contactName,
      contactEmail: a.contactEmail,
      contactPhone: a.contactPhone,
      estimatedMonthlyVolume: a.estimatedMonthlyVolume,
      applicationNotes: a.applicationNotes,
    },
    review: {
      reviewedBy: a.reviewedBy ? { id: a.reviewedBy.id, name: a.reviewedBy.name } : null,
      reviewedAt: a.reviewedAt,
      reviewNotes: a.reviewNotes,
      rejectionReason: a.rejectionReason,
    },
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

async function getOr404(id: string): Promise<AccountRow> {
  const row = await prisma.wholesaleAccount.findUnique({ where: { id }, ...WITH });
  if (!row) throw HttpError.notFound("Wholesale account not found");
  return row;
}

/* --------------------------------- list -------------------------------- */

export async function listAccounts(req: Request, res: Response) {
  const q = req.query as unknown as ListWholesaleQuery;

  const where: Prisma.WholesaleAccountWhereInput = {};
  if (q.status) where.status = q.status;
  if (q.q) {
    where.OR = [
      { businessName: { contains: q.q, mode: "insensitive" } },
      { contactName: { contains: q.q, mode: "insensitive" } },
      { contactEmail: { contains: q.q, mode: "insensitive" } },
      { customer: { email: { contains: q.q, mode: "insensitive" } } },
    ];
  }

  const orderBy: Prisma.WholesaleAccountOrderByWithRelationInput =
    q.sort === "createdAt"
      ? { createdAt: "asc" }
      : q.sort === "businessName"
        ? { businessName: "asc" }
        : q.sort === "-businessName"
          ? { businessName: "desc" }
          : { createdAt: "desc" };

  const [total, rows, groups] = await Promise.all([
    prisma.wholesaleAccount.count({ where }),
    prisma.wholesaleAccount.findMany({
      where,
      orderBy,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      ...WITH,
    }),
    prisma.wholesaleAccount.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const statusCounts = { PENDING: 0, APPROVED: 0, REJECTED: 0 } as Record<string, number>;
  for (const g of groups) statusCounts[g.status] = g._count._all;

  res.json({
    data: rows.map(serialize),
    pagination: { page: q.page, pageSize: q.pageSize, total, pageCount: Math.ceil(total / q.pageSize) },
    statusCounts,
  });
}

/* --------------------------------- detail ------------------------------ */

export async function getAccount(req: Request, res: Response) {
  const account = await getOr404(req.params.id!);
  const [auditTrail, orderCount, quoteCount] = await Promise.all([
    prisma.auditLog.findMany({
      where: { entityType: "WholesaleAccount", entityId: account.id },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { actor: { select: { name: true } } },
    }),
    prisma.order.count({
      where: { customerId: account.customer.id, status: { not: "PENDING_PAYMENT" } },
    }),
    prisma.quote.count({ where: { customerId: account.customer.id } }),
  ]);

  res.json({
    data: {
      ...serialize(account),
      customerActivity: { orders: orderCount, quotes: quoteCount },
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

/* ------------------------------ intake (admin) ------------------------- */

export async function createApplication(
  req: Request<unknown, unknown, CreateApplicationInput>,
  res: Response,
) {
  const b = req.body;

  const account = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.upsert({
      where: { email: b.email },
      update: { type: "WHOLESALE", firstName: b.firstName, lastName: b.lastName, phone: b.phone ?? undefined },
      create: {
        type: "WHOLESALE",
        email: b.email,
        firstName: b.firstName,
        lastName: b.lastName,
        phone: b.phone ?? null,
      },
    });

    const existing = await tx.wholesaleAccount.findUnique({ where: { customerId: customer.id } });
    if (existing) {
      throw HttpError.conflict("This customer already has a wholesale account/application");
    }

    return tx.wholesaleAccount.create({
      data: {
        customerId: customer.id,
        status: "PENDING",
        businessName: b.businessName,
        businessRegistrationNumber: b.businessRegistrationNumber ?? null,
        taxId: b.taxId ?? null,
        businessType: b.businessType ?? null,
        website: b.website ?? null,
        contactName: `${b.firstName} ${b.lastName}`.trim(),
        contactEmail: b.email,
        contactPhone: b.phone ?? null,
        estimatedMonthlyVolume: b.estimatedMonthlyVolume ?? null,
        applicationNotes: b.applicationNotes ?? null,
      },
      ...WITH,
    });
  });

  await writeAudit({
    actorId: req.auth?.userId,
    action: "wholesale_account.application_created",
    entityType: "WholesaleAccount",
    entityId: account.id,
    summary: `Application logged for "${account.businessName}"`,
  });

  res.status(201).json({ data: serialize(account) });
}

/* ---------------------------- approve / reject ----------------------- */

export async function approveAccount(req: Request<{ id: string }>, res: Response) {
  const account = await getOr404(req.params.id);
  if (account.status === "APPROVED") throw HttpError.conflict("Account is already approved");

  const reviewNotes: string | undefined = req.body?.reviewNotes;
  const updated = await prisma.wholesaleAccount.update({
    where: { id: account.id },
    data: {
      status: "APPROVED",
      reviewedById: req.auth!.userId,
      reviewedAt: new Date(),
      reviewNotes: reviewNotes ?? null,
      rejectionReason: null,
    },
    ...WITH,
  });

  await writeAudit({
    actorId: req.auth?.userId,
    action: "wholesale_account.approved",
    entityType: "WholesaleAccount",
    entityId: account.id,
    summary: `${req.auth?.name} approved "${account.businessName}"`,
    metadata: { from: account.status, reviewNotes: reviewNotes ?? null },
  });

  res.json({ data: serialize(updated) });
}

export async function rejectAccount(req: Request<{ id: string }>, res: Response) {
  const account = await getOr404(req.params.id);
  if (account.status === "REJECTED") throw HttpError.conflict("Account is already rejected");

  const { rejectionReason, reviewNotes } = req.body as { rejectionReason: string; reviewNotes?: string };
  const updated = await prisma.wholesaleAccount.update({
    where: { id: account.id },
    data: {
      status: "REJECTED",
      reviewedById: req.auth!.userId,
      reviewedAt: new Date(),
      reviewNotes: reviewNotes ?? null,
      rejectionReason,
    },
    ...WITH,
  });

  await writeAudit({
    actorId: req.auth?.userId,
    action: account.status === "APPROVED" ? "wholesale_account.access_revoked" : "wholesale_account.rejected",
    entityType: "WholesaleAccount",
    entityId: account.id,
    summary: `${req.auth?.name} ${account.status === "APPROVED" ? "revoked access for" : "rejected"} "${account.businessName}"`,
    metadata: { from: account.status, rejectionReason },
  });

  res.json({ data: serialize(updated) });
}
