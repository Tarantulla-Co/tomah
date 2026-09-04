import type { Request, Response } from "express";
import { prisma, Prisma } from "@tomah/db";
import { HttpError } from "../lib/http-error.js";
import { writeAudit } from "../lib/audit.js";
import { slugify } from "../lib/slug.js";
import type {
  CreateFaqInput,
  CreateRecipeInput,
  CreateTestimonialInput,
  ListContentQuery,
} from "../validators/content.schema.js";

type Decimalish = Prisma.Decimal | null;
const dec = (v: Decimalish) => (v == null ? null : v.toString());

/* -------------------------------- helpers ------------------------------- */

function listArgs(q: ListContentQuery) {
  const dir = q.sort.startsWith("-") ? "desc" : "asc";
  const field = q.sort.replace(/^-/, "") as "position" | "updatedAt";
  return {
    orderBy: { [field]: dir } as Record<string, "asc" | "desc">,
    skip: (q.page - 1) * q.pageSize,
    take: q.pageSize,
  };
}

function toPublishedCounts(groups: Array<{ isPublished: boolean; _count: { _all: number } }>) {
  const counts = { published: 0, draft: 0 };
  for (const g of groups) {
    if (g.isPublished) counts.published = g._count._all;
    else counts.draft = g._count._all;
  }
  return counts;
}

/* ================================== FAQ =============================== */

const serializeFaq = (f: {
  id: string; question: string; answer: string; category: string | null;
  position: number; isPublished: boolean; createdAt: Date; updatedAt: Date;
}) => ({ ...f });

export async function listFaqs(req: Request, res: Response) {
  const q = req.query as unknown as ListContentQuery;
  const where: Prisma.FaqWhereInput = {};
  if (q.status) where.isPublished = q.status === "published";
  if (q.q) {
    where.OR = [
      { question: { contains: q.q, mode: "insensitive" } },
      { answer: { contains: q.q, mode: "insensitive" } },
      { category: { contains: q.q, mode: "insensitive" } },
    ];
  }
  const [total, rows, counts] = await Promise.all([
    prisma.faq.count({ where }),
    prisma.faq.findMany({ where, ...listArgs(q) }),
    prisma.faq.groupBy({ by: ["isPublished"], _count: { _all: true } }),
  ]);
  res.json({
    data: rows.map(serializeFaq),
    pagination: { page: q.page, pageSize: q.pageSize, total, pageCount: Math.ceil(total / q.pageSize) },
    counts: toPublishedCounts(counts),
  });
}

export async function createFaq(req: Request<unknown, unknown, CreateFaqInput>, res: Response) {
  const b = req.body;
  const faq = await prisma.faq.create({
    data: {
      question: b.question,
      answer: b.answer,
      category: b.category ?? null,
      position: b.position ?? 0,
      isPublished: b.isPublished ?? false,
    },
  });
  await writeAudit({
    actorId: req.auth?.userId,
    action: "content.faq_created",
    entityType: "Faq",
    entityId: faq.id,
    summary: `${req.auth?.name} added FAQ "${faq.question}"`,
  });
  res.status(201).json({ data: serializeFaq(faq) });
}

export async function updateFaq(req: Request<{ id: string }>, res: Response) {
  const id = req.params.id;
  const existing = await prisma.faq.findUnique({ where: { id } });
  if (!existing) throw HttpError.notFound("FAQ not found");
  const b = req.body as Partial<CreateFaqInput>;
  const data: Prisma.FaqUpdateInput = {};
  if (b.question !== undefined) data.question = b.question;
  if (b.answer !== undefined) data.answer = b.answer;
  if (b.category !== undefined) data.category = b.category ?? null;
  if (b.position !== undefined) data.position = b.position;
  if (b.isPublished !== undefined) data.isPublished = b.isPublished;
  const faq = await prisma.faq.update({ where: { id }, data });
  await writeAudit({
    actorId: req.auth?.userId,
    action: "content.faq_updated",
    entityType: "Faq",
    entityId: id,
    summary: `${req.auth?.name} updated FAQ "${faq.question}"`,
    metadata: { fields: Object.keys(data) },
  });
  res.json({ data: serializeFaq(faq) });
}

export async function deleteFaq(req: Request<{ id: string }>, res: Response) {
  const id = req.params.id;
  const existing = await prisma.faq.findUnique({ where: { id } });
  if (!existing) throw HttpError.notFound("FAQ not found");
  await prisma.faq.delete({ where: { id } });
  await writeAudit({
    actorId: req.auth?.userId,
    action: "content.faq_deleted",
    entityType: "Faq",
    entityId: id,
    summary: `${req.auth?.name} deleted FAQ "${existing.question}"`,
  });
  res.status(204).send();
}

/* ============================= TESTIMONIAL =========================== */

const serializeTestimonial = (t: {
  id: string; authorName: string; authorTitle: string | null; quote: string;
  rating: number | null; position: number; isPublished: boolean;
  createdAt: Date; updatedAt: Date;
}) => ({ ...t });

export async function listTestimonials(req: Request, res: Response) {
  const q = req.query as unknown as ListContentQuery;
  const where: Prisma.TestimonialWhereInput = {};
  if (q.status) where.isPublished = q.status === "published";
  if (q.q) {
    where.OR = [
      { authorName: { contains: q.q, mode: "insensitive" } },
      { authorTitle: { contains: q.q, mode: "insensitive" } },
      { quote: { contains: q.q, mode: "insensitive" } },
    ];
  }
  const [total, rows, counts] = await Promise.all([
    prisma.testimonial.count({ where }),
    prisma.testimonial.findMany({ where, ...listArgs(q) }),
    prisma.testimonial.groupBy({ by: ["isPublished"], _count: { _all: true } }),
  ]);
  res.json({
    data: rows.map(serializeTestimonial),
    pagination: { page: q.page, pageSize: q.pageSize, total, pageCount: Math.ceil(total / q.pageSize) },
    counts: toPublishedCounts(counts),
  });
}

export async function createTestimonial(
  req: Request<unknown, unknown, CreateTestimonialInput>,
  res: Response,
) {
  const b = req.body;
  const t = await prisma.testimonial.create({
    data: {
      authorName: b.authorName,
      authorTitle: b.authorTitle ?? null,
      quote: b.quote,
      rating: b.rating ?? null,
      position: b.position ?? 0,
      isPublished: b.isPublished ?? false,
    },
  });
  await writeAudit({
    actorId: req.auth?.userId,
    action: "content.testimonial_created",
    entityType: "Testimonial",
    entityId: t.id,
    summary: `${req.auth?.name} added a testimonial from ${t.authorName}`,
  });
  res.status(201).json({ data: serializeTestimonial(t) });
}

export async function updateTestimonial(req: Request<{ id: string }>, res: Response) {
  const id = req.params.id;
  const existing = await prisma.testimonial.findUnique({ where: { id } });
  if (!existing) throw HttpError.notFound("Testimonial not found");
  const b = req.body as Partial<CreateTestimonialInput>;
  const data: Prisma.TestimonialUpdateInput = {};
  if (b.authorName !== undefined) data.authorName = b.authorName;
  if (b.authorTitle !== undefined) data.authorTitle = b.authorTitle ?? null;
  if (b.quote !== undefined) data.quote = b.quote;
  if (b.rating !== undefined) data.rating = b.rating ?? null;
  if (b.position !== undefined) data.position = b.position;
  if (b.isPublished !== undefined) data.isPublished = b.isPublished;
  const t = await prisma.testimonial.update({ where: { id }, data });
  await writeAudit({
    actorId: req.auth?.userId,
    action: "content.testimonial_updated",
    entityType: "Testimonial",
    entityId: id,
    summary: `${req.auth?.name} updated the testimonial from ${t.authorName}`,
    metadata: { fields: Object.keys(data) },
  });
  res.json({ data: serializeTestimonial(t) });
}

export async function deleteTestimonial(req: Request<{ id: string }>, res: Response) {
  const id = req.params.id;
  const existing = await prisma.testimonial.findUnique({ where: { id } });
  if (!existing) throw HttpError.notFound("Testimonial not found");
  await prisma.testimonial.delete({ where: { id } });
  await writeAudit({
    actorId: req.auth?.userId,
    action: "content.testimonial_deleted",
    entityType: "Testimonial",
    entityId: id,
    summary: `${req.auth?.name} deleted the testimonial from ${existing.authorName}`,
  });
  res.status(204).send();
}

/* ================================ RECIPE ============================= */

const serializeRecipe = (r: {
  id: string; title: string; slug: string; summary: string | null;
  ingredients: string[]; steps: string[]; imageUrl: string | null;
  relatedProductIds: string[]; position: number; isPublished: boolean;
  createdAt: Date; updatedAt: Date;
}) => ({ ...r });

async function uniqueRecipeSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || "recipe";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const clash = await prisma.recipe.findFirst({
      where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  return `${root}-${Date.now()}`;
}

export async function listRecipes(req: Request, res: Response) {
  const q = req.query as unknown as ListContentQuery;
  const where: Prisma.RecipeWhereInput = {};
  if (q.status) where.isPublished = q.status === "published";
  if (q.q) {
    where.OR = [
      { title: { contains: q.q, mode: "insensitive" } },
      { summary: { contains: q.q, mode: "insensitive" } },
    ];
  }
  const [total, rows, counts] = await Promise.all([
    prisma.recipe.count({ where }),
    prisma.recipe.findMany({ where, ...listArgs(q) }),
    prisma.recipe.groupBy({ by: ["isPublished"], _count: { _all: true } }),
  ]);
  res.json({
    data: rows.map(serializeRecipe),
    pagination: { page: q.page, pageSize: q.pageSize, total, pageCount: Math.ceil(total / q.pageSize) },
    counts: toPublishedCounts(counts),
  });
}

export async function createRecipe(req: Request<unknown, unknown, CreateRecipeInput>, res: Response) {
  const b = req.body;
  const slug = await uniqueRecipeSlug(b.slug || b.title);
  const r = await prisma.recipe.create({
    data: {
      title: b.title,
      slug,
      summary: b.summary ?? null,
      ingredients: b.ingredients,
      steps: b.steps,
      imageUrl: b.imageUrl ?? null,
      relatedProductIds: b.relatedProductIds,
      position: b.position ?? 0,
      isPublished: b.isPublished ?? false,
    },
  });
  await writeAudit({
    actorId: req.auth?.userId,
    action: "content.recipe_created",
    entityType: "Recipe",
    entityId: r.id,
    summary: `${req.auth?.name} added recipe "${r.title}"`,
  });
  res.status(201).json({ data: serializeRecipe(r) });
}

export async function updateRecipe(req: Request<{ id: string }>, res: Response) {
  const id = req.params.id;
  const existing = await prisma.recipe.findUnique({ where: { id } });
  if (!existing) throw HttpError.notFound("Recipe not found");
  const b = req.body as Partial<CreateRecipeInput>;
  const data: Prisma.RecipeUpdateInput = {};
  if (b.title !== undefined) data.title = b.title;
  if (b.slug !== undefined) data.slug = await uniqueRecipeSlug(b.slug || b.title || existing.title, id);
  if (b.summary !== undefined) data.summary = b.summary ?? null;
  if (b.ingredients !== undefined) data.ingredients = b.ingredients;
  if (b.steps !== undefined) data.steps = b.steps;
  if (b.imageUrl !== undefined) data.imageUrl = b.imageUrl ?? null;
  if (b.relatedProductIds !== undefined) data.relatedProductIds = b.relatedProductIds;
  if (b.position !== undefined) data.position = b.position;
  if (b.isPublished !== undefined) data.isPublished = b.isPublished;
  const r = await prisma.recipe.update({ where: { id }, data });
  await writeAudit({
    actorId: req.auth?.userId,
    action: "content.recipe_updated",
    entityType: "Recipe",
    entityId: id,
    summary: `${req.auth?.name} updated recipe "${r.title}"`,
    metadata: { fields: Object.keys(data) },
  });
  res.json({ data: serializeRecipe(r) });
}

export async function deleteRecipe(req: Request<{ id: string }>, res: Response) {
  const id = req.params.id;
  const existing = await prisma.recipe.findUnique({ where: { id } });
  if (!existing) throw HttpError.notFound("Recipe not found");
  await prisma.recipe.delete({ where: { id } });
  await writeAudit({
    actorId: req.auth?.userId,
    action: "content.recipe_deleted",
    entityType: "Recipe",
    entityId: id,
    summary: `${req.auth?.name} deleted recipe "${existing.title}"`,
  });
  res.status(204).send();
}

/* =========================== FEATURED PRODUCTS ====================== */

const FEATURED_WITH = {
  include: {
    product: {
      select: {
        id: true, name: true, sku: true, slug: true, currency: true,
        retailPrice: true, isPublished: true,
        images: {
          orderBy: [{ isPrimary: "desc" }, { position: "asc" }],
          take: 1,
          select: { url: true },
        },
      },
    },
  },
} satisfies Prisma.FeaturedProductDefaultArgs;

type FeaturedRow = Prisma.FeaturedProductGetPayload<typeof FEATURED_WITH>;

function serializeFeatured(f: FeaturedRow) {
  return {
    id: f.id,
    productId: f.productId,
    position: f.position,
    note: f.note,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
    product: {
      id: f.product.id,
      name: f.product.name,
      sku: f.product.sku,
      slug: f.product.slug,
      currency: f.product.currency,
      retailPrice: dec(f.product.retailPrice),
      isPublished: f.product.isPublished,
      imageUrl: f.product.images[0]?.url ?? null,
    },
  };
}

export async function listFeatured(_req: Request, res: Response) {
  const rows = await prisma.featuredProduct.findMany({
    orderBy: { position: "asc" },
    ...FEATURED_WITH,
  });
  res.json({ data: rows.map(serializeFeatured) });
}

export async function createFeatured(req: Request, res: Response) {
  const { productId, position, note } = req.body as {
    productId: string; position?: number; note?: string | null;
  };

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, name: true } });
  if (!product) throw HttpError.notFound("Product not found");

  const existing = await prisma.featuredProduct.findUnique({ where: { productId } });
  if (existing) throw HttpError.conflict("That product is already featured");

  let pos = position;
  if (pos === undefined) {
    const last = await prisma.featuredProduct.findFirst({ orderBy: { position: "desc" }, select: { position: true } });
    pos = last ? last.position + 1 : 0;
  }

  const row = await prisma.featuredProduct.create({
    data: { productId, position: pos, note: note ?? null },
    ...FEATURED_WITH,
  });
  await writeAudit({
    actorId: req.auth?.userId,
    action: "content.featured_added",
    entityType: "FeaturedProduct",
    entityId: row.id,
    summary: `${req.auth?.name} featured "${product.name}"`,
  });
  res.status(201).json({ data: serializeFeatured(row) });
}

export async function updateFeatured(req: Request<{ id: string }>, res: Response) {
  const id = req.params.id;
  const existing = await prisma.featuredProduct.findUnique({ where: { id } });
  if (!existing) throw HttpError.notFound("Featured entry not found");
  const b = req.body as { position?: number; note?: string | null };
  const data: Prisma.FeaturedProductUpdateInput = {};
  if (b.position !== undefined) data.position = b.position;
  if (b.note !== undefined) data.note = b.note ?? null;
  const row = await prisma.featuredProduct.update({ where: { id }, data, ...FEATURED_WITH });
  await writeAudit({
    actorId: req.auth?.userId,
    action: "content.featured_updated",
    entityType: "FeaturedProduct",
    entityId: id,
    summary: `${req.auth?.name} updated a featured product`,
    metadata: { fields: Object.keys(data) },
  });
  res.json({ data: serializeFeatured(row) });
}

export async function deleteFeatured(req: Request<{ id: string }>, res: Response) {
  const id = req.params.id;
  const existing = await prisma.featuredProduct.findUnique({
    where: { id },
    include: { product: { select: { name: true } } },
  });
  if (!existing) throw HttpError.notFound("Featured entry not found");
  await prisma.featuredProduct.delete({ where: { id } });
  await writeAudit({
    actorId: req.auth?.userId,
    action: "content.featured_removed",
    entityType: "FeaturedProduct",
    entityId: id,
    summary: `${req.auth?.name} un-featured "${existing.product.name}"`,
  });
  res.status(204).send();
}

export async function reorderFeatured(req: Request, res: Response) {
  const { ids } = req.body as { ids: string[] };
  const rows = await prisma.featuredProduct.findMany({ select: { id: true } });
  const known = new Set(rows.map((r) => r.id));
  if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
    throw HttpError.badRequest("ids must list every featured entry exactly once");
  }
  await prisma.$transaction(
    ids.map((id, index) => prisma.featuredProduct.update({ where: { id }, data: { position: index } })),
  );
  await writeAudit({
    actorId: req.auth?.userId,
    action: "content.featured_reordered",
    entityType: "FeaturedProduct",
    entityId: "*",
    summary: `${req.auth?.name} reordered featured products`,
    metadata: { order: ids },
  });
  const updated = await prisma.featuredProduct.findMany({ orderBy: { position: "asc" }, ...FEATURED_WITH });
  res.json({ data: updated.map(serializeFeatured) });
}
