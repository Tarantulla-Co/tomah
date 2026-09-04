import type { Request, Response } from "express";
import { prisma, Prisma } from "@tomah/db";
import { HttpError } from "../lib/http-error.js";
import { slugify } from "../lib/slug.js";
import { writeAudit } from "../lib/audit.js";
import { storage } from "../lib/storage/index.js";
import {
  PRODUCT_CATEGORIES,
  type CreateProductInput,
  type ListProductsQuery,
  type UpdateProductInput,
  type UpdateStockInput,
} from "../validators/product.schema.js";

/* ------------------------------ serializers ----------------------------- */
// Prisma returns Decimal instances; hand the client plain strings so numbers
// survive JSON without precision loss.

type Decimalish = Prisma.Decimal | null;
const dec = (v: Decimalish) => (v == null ? null : v.toString());

function serializeVariant(v: {
  id: string; name: string; sku: string; barcode: string | null;
  retailPrice: Decimalish; wholesalePrice: Decimalish; minimumOrderQuantity: number | null;
  stockQuantity: number; weightGrams: number | null; isActive: boolean; position: number;
}) {
  return {
    ...v,
    retailPrice: dec(v.retailPrice),
    wholesalePrice: dec(v.wholesalePrice),
  };
}

function serializeProduct(p: Prisma.ProductGetPayload<{ include: { variants: true; images: true } }>) {
  return {
    id: p.id,
    sku: p.sku,
    barcode: p.barcode,
    name: p.name,
    slug: p.slug,
    shortDescription: p.shortDescription,
    longDescription: p.longDescription,
    category: p.category,
    countryOfOrigin: p.countryOfOrigin,
    certifications: p.certifications,
    currency: p.currency,
    // Public field.
    retailPrice: dec(p.retailPrice),
    // Gated fields: the storefront must withhold these from non-approved
    // customers (see docs/DATA_MODEL.md). Staff always see them.
    wholesalePrice: dec(p.wholesalePrice),
    minimumOrderQuantity: p.minimumOrderQuantity,
    isRetailAvailable: p.isRetailAvailable,
    isWholesaleAvailable: p.isWholesaleAvailable,
    stock: {
      quantity: p.stockQuantity,
      source: p.stockSource,
      syncEnabled: p.stockSyncEnabled,
      updatedAt: p.stockUpdatedAt,
    },
    isPublished: p.isPublished,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    images: [...p.images]
      .sort((a, b) => a.position - b.position)
      .map(({ storageKey: _k, ...img }) => ({ ...img, isUploaded: _k != null })),
    variants: [...p.variants].sort((a, b) => a.position - b.position).map(serializeVariant),
  };
}

const withRelations = { include: { variants: true, images: true } } as const;

/* -------------------------------- helpers ------------------------------- */

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || "product";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const clash = await prisma.product.findFirst({
      where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  return `${root}-${Date.now()}`;
}

async function getProductOr404(id: string) {
  const product = await prisma.product.findUnique({ where: { id }, ...withRelations });
  if (!product) throw HttpError.notFound("Product not found");
  return product;
}

/* --------------------------------- list -------------------------------- */

export async function listProducts(req: Request, res: Response) {
  const q = req.query as unknown as ListProductsQuery;

  const where: Prisma.ProductWhereInput = {};
  if (q.category) where.category = q.category;
  if (q.status) where.isPublished = q.status === "published";
  if (q.stock === "in") where.stockQuantity = { gt: 0 };
  if (q.stock === "out") where.stockQuantity = { lte: 0 };
  if (q.channel === "retail") where.isRetailAvailable = true;
  if (q.channel === "wholesale") where.isWholesaleAvailable = true;
  if (q.q) {
    where.OR = [
      { name: { contains: q.q, mode: "insensitive" } },
      { sku: { contains: q.q, mode: "insensitive" } },
      { barcode: { contains: q.q, mode: "insensitive" } },
    ];
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    q.sort === "name"
      ? { name: "asc" }
      : q.sort === "-name"
        ? { name: "desc" }
        : q.sort === "updatedAt"
          ? { updatedAt: "asc" }
          : q.sort === "stock"
            ? { stockQuantity: "asc" }
            : q.sort === "-stock"
              ? { stockQuantity: "desc" }
              : { updatedAt: "desc" };

  const [total, rows, categoryGroups] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      ...withRelations,
    }),
    prisma.product.groupBy({ by: ["category"], _count: { _all: true } }),
  ]);

  const counts = Object.fromEntries(PRODUCT_CATEGORIES.map((c) => [c, 0])) as Record<string, number>;
  for (const g of categoryGroups) counts[g.category] = g._count._all;

  res.json({
    data: rows.map(serializeProduct),
    pagination: { page: q.page, pageSize: q.pageSize, total, pageCount: Math.ceil(total / q.pageSize) },
    categoryCounts: counts,
  });
}

export async function getProduct(req: Request, res: Response) {
  res.json({ data: serializeProduct(await getProductOr404(req.params.id!)) });
}

/* ------------------------------ create/update -------------------------- */

export async function createProduct(req: Request<unknown, unknown, CreateProductInput>, res: Response) {
  const body = req.body;
  const slug = await uniqueSlug(body.slug || body.name);

  try {
    const product = await prisma.product.create({
      data: {
        name: body.name,
        slug,
        sku: body.sku,
        barcode: body.barcode ?? null,
        category: body.category,
        shortDescription: body.shortDescription ?? null,
        longDescription: body.longDescription ?? null,
        countryOfOrigin: body.countryOfOrigin ?? null,
        certifications: body.certifications,
        currency: body.currency,
        retailPrice: body.retailPrice ?? null,
        wholesalePrice: body.wholesalePrice ?? null,
        minimumOrderQuantity: body.minimumOrderQuantity ?? null,
        isRetailAvailable: body.isRetailAvailable,
        isWholesaleAvailable: body.isWholesaleAvailable,
        stockQuantity: body.stockQuantity,
        stockSource: "MANUAL",
        stockSyncEnabled: body.stockSyncEnabled,
        stockUpdatedAt: new Date(),
        isPublished: body.isPublished,
      },
      ...withRelations,
    });

    await writeAudit({
      actorId: req.auth?.userId,
      action: "product.created",
      entityType: "Product",
      entityId: product.id,
      summary: `Created product "${product.name}" (${product.sku})`,
    });

    res.status(201).json({ data: serializeProduct(product) });
  } catch (e) {
    throw mapProductWriteError(e);
  }
}

export async function updateProduct(req: Request<{ id: string }, unknown, UpdateProductInput>, res: Response) {
  const id = req.params.id;
  const existing = await getProductOr404(id);
  const body = req.body;

  const data: Prisma.ProductUpdateInput = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.slug !== undefined) data.slug = await uniqueSlug(body.slug || body.name || existing.name, id);
  if (body.sku !== undefined) data.sku = body.sku;
  if (body.barcode !== undefined) data.barcode = body.barcode ?? null;
  if (body.category !== undefined) data.category = body.category;
  if (body.shortDescription !== undefined) data.shortDescription = body.shortDescription ?? null;
  if (body.longDescription !== undefined) data.longDescription = body.longDescription ?? null;
  if (body.countryOfOrigin !== undefined) data.countryOfOrigin = body.countryOfOrigin ?? null;
  if (body.certifications !== undefined) data.certifications = body.certifications;
  if (body.currency !== undefined) data.currency = body.currency;
  if (body.retailPrice !== undefined) data.retailPrice = body.retailPrice ?? null;
  if (body.wholesalePrice !== undefined) data.wholesalePrice = body.wholesalePrice ?? null;
  if (body.minimumOrderQuantity !== undefined) data.minimumOrderQuantity = body.minimumOrderQuantity ?? null;
  if (body.isRetailAvailable !== undefined) data.isRetailAvailable = body.isRetailAvailable;
  if (body.isWholesaleAvailable !== undefined) data.isWholesaleAvailable = body.isWholesaleAvailable;
  if (body.stockSyncEnabled !== undefined) data.stockSyncEnabled = body.stockSyncEnabled;
  if (body.isPublished !== undefined) data.isPublished = body.isPublished;
  // Note: stockQuantity is intentionally NOT updated here — use PATCH /stock so
  // every stock change is explicit and stamps stockSource = MANUAL.

  try {
    const product = await prisma.product.update({ where: { id }, data, ...withRelations });
    await writeAudit({
      actorId: req.auth?.userId,
      action: "product.updated",
      entityType: "Product",
      entityId: id,
      summary: `Updated product "${product.name}"`,
      metadata: { fields: Object.keys(data) },
    });
    res.json({ data: serializeProduct(product) });
  } catch (e) {
    throw mapProductWriteError(e);
  }
}

export async function deleteProduct(req: Request, res: Response) {
  const id = req.params.id!;
  const existing = await getProductOr404(id);
  await prisma.product.delete({ where: { id } });
  await writeAudit({
    actorId: req.auth?.userId,
    action: "product.deleted",
    entityType: "Product",
    entityId: id,
    summary: `Deleted product "${existing.name}" (${existing.sku})`,
  });
  res.status(204).send();
}

/* --------------------------------- stock ------------------------------- */

export async function updateStock(req: Request<{ id: string }, unknown, UpdateStockInput>, res: Response) {
  const id = req.params.id;
  const existing = await getProductOr404(id);
  const { stockQuantity, stockSyncEnabled, note } = req.body;

  const product = await prisma.product.update({
    where: { id },
    data: {
      stockQuantity,
      stockSource: "MANUAL",
      stockUpdatedAt: new Date(),
      ...(stockSyncEnabled !== undefined ? { stockSyncEnabled } : {}),
    },
    ...withRelations,
  });

  await writeAudit({
    actorId: req.auth?.userId,
    action: "product.stock_adjusted",
    entityType: "Product",
    entityId: id,
    summary: `Stock ${existing.stockQuantity} → ${stockQuantity} for "${existing.name}"`,
    metadata: { from: existing.stockQuantity, to: stockQuantity, note: note ?? null },
  });

  res.json({ data: serializeProduct(product) });
}

/* -------------------------------- variants ----------------------------- */

export async function addVariant(req: Request<{ id: string }>, res: Response) {
  await getProductOr404(req.params.id);
  try {
    await prisma.productVariant.create({ data: { ...req.body, productId: req.params.id } });
  } catch (e) {
    throw mapProductWriteError(e);
  }
  res.status(201).json({ data: serializeProduct(await getProductOr404(req.params.id)) });
}

export async function updateVariant(req: Request<{ id: string; variantId: string }>, res: Response) {
  const { id, variantId } = req.params;
  const variant = await prisma.productVariant.findFirst({ where: { id: variantId, productId: id } });
  if (!variant) throw HttpError.notFound("Variant not found on this product");
  try {
    await prisma.productVariant.update({ where: { id: variantId }, data: req.body });
  } catch (e) {
    throw mapProductWriteError(e);
  }
  res.json({ data: serializeProduct(await getProductOr404(id)) });
}

export async function deleteVariant(req: Request<{ id: string; variantId: string }>, res: Response) {
  const { id, variantId } = req.params;
  const variant = await prisma.productVariant.findFirst({ where: { id: variantId, productId: id } });
  if (!variant) throw HttpError.notFound("Variant not found on this product");
  await prisma.productVariant.delete({ where: { id: variantId } });
  res.json({ data: serializeProduct(await getProductOr404(id)) });
}

/* --------------------------------- images ----------------------------- */

export async function addImage(req: Request<{ id: string }>, res: Response) {
  const id = req.params.id;
  await getProductOr404(id);
  await prisma.$transaction(async (tx) => {
    if (req.body.isPrimary) {
      await tx.productImage.updateMany({ where: { productId: id }, data: { isPrimary: false } });
    }
    await tx.productImage.create({ data: { ...req.body, productId: id } });
  });
  res.status(201).json({ data: serializeProduct(await getProductOr404(id)) });
}

/** POST /products/:id/images/upload — multipart, field `file`. */
export async function uploadImage(req: Request<{ id: string }>, res: Response) {
  const id = req.params.id;
  await getProductOr404(id);

  const file = req.file;
  if (!file) throw HttpError.badRequest("No file provided (expected multipart field 'file')");

  const makePrimary = String(req.body?.isPrimary ?? "").toLowerCase() === "true";
  const altText = typeof req.body?.altText === "string" && req.body.altText.trim() ? req.body.altText.trim() : null;

  const stored = await storage.put({
    buffer: file.buffer,
    contentType: file.mimetype,
    prefix: "products",
    filename: file.originalname,
  });

  try {
    await prisma.$transaction(async (tx) => {
      const first = (await tx.productImage.count({ where: { productId: id } })) === 0;
      if (makePrimary || first) {
        await tx.productImage.updateMany({ where: { productId: id }, data: { isPrimary: false } });
      }
      await tx.productImage.create({
        data: {
          productId: id,
          url: stored.url,
          storageKey: stored.key,
          altText,
          isPrimary: makePrimary || first,
        },
      });
    });
  } catch (e) {
    // Roll the file back if the DB write failed.
    await storage.delete(stored.key).catch(() => undefined);
    throw e;
  }

  await writeAudit({
    actorId: req.auth?.userId,
    action: "product.image_uploaded",
    entityType: "Product",
    entityId: id,
    summary: `Uploaded image (${file.mimetype}, ${(file.size / 1024).toFixed(0)}KB)`,
    metadata: { key: stored.key, adapter: storage.name },
  });

  res.status(201).json({ data: serializeProduct(await getProductOr404(id)) });
}

export async function updateImage(req: Request<{ id: string; imageId: string }>, res: Response) {
  const { id, imageId } = req.params;
  const image = await prisma.productImage.findFirst({ where: { id: imageId, productId: id } });
  if (!image) throw HttpError.notFound("Image not found on this product");
  await prisma.$transaction(async (tx) => {
    if (req.body.isPrimary) {
      await tx.productImage.updateMany({
        where: { productId: id, NOT: { id: imageId } },
        data: { isPrimary: false },
      });
    }
    await tx.productImage.update({ where: { id: imageId }, data: req.body });
  });
  res.json({ data: serializeProduct(await getProductOr404(id)) });
}

export async function deleteImage(req: Request<{ id: string; imageId: string }>, res: Response) {
  const { id, imageId } = req.params;
  const image = await prisma.productImage.findFirst({ where: { id: imageId, productId: id } });
  if (!image) throw HttpError.notFound("Image not found on this product");
  await prisma.productImage.delete({ where: { id: imageId } });
  // Remove the underlying file only for uploads we own (storageKey set).
  if (image.storageKey) await storage.delete(image.storageKey).catch(() => undefined);
  res.json({ data: serializeProduct(await getProductOr404(id)) });
}

/* -------------------------------- errors ------------------------------ */

function mapProductWriteError(e: unknown): unknown {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    const target = (e.meta?.target as string[] | undefined)?.join(", ") ?? "value";
    return HttpError.conflict(`A product or variant with that ${target} already exists`);
  }
  return e;
}
