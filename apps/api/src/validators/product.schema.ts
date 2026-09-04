import { z } from "zod";

export const PRODUCT_CATEGORIES = [
  "POULTRY",
  "PORK",
  "MEATS",
  "SEAFOOD",
  "GRAINS",
  "VEGETABLES_AND_FRIES",
  "MAPLE_PRODUCTS",
] as const;

const categoryEnum = z.enum(PRODUCT_CATEGORIES);

/** Accepts a number or numeric string, yields a non-negative number (or null). */
const money = z
  .union([z.number(), z.string()])
  .transform((v, ctx) => {
    const n = typeof v === "string" ? Number(v) : v;
    if (!Number.isFinite(n) || n < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Must be a non-negative number" });
      return z.NEVER;
    }
    return Math.round(n * 100) / 100;
  });

const moneyNullable = money.nullable();

/* ------------------------------- list query ------------------------------ */

export const listProductsQuery = z.object({
  q: z.string().trim().max(120).optional(),
  category: categoryEnum.optional(),
  status: z.enum(["published", "draft"]).optional(),
  stock: z.enum(["in", "out"]).optional(),
  channel: z.enum(["retail", "wholesale"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(["name", "-name", "updatedAt", "-updatedAt", "stock", "-stock"]).default("-updatedAt"),
});
export type ListProductsQuery = z.infer<typeof listProductsQuery>;

/* --------------------------------- product ------------------------------- */

export const createProductSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().max(80).optional(),
  sku: z.string().trim().min(1).max(64),
  barcode: z.string().trim().max(64).nullish(),
  category: categoryEnum,
  shortDescription: z.string().trim().max(300).nullish(),
  longDescription: z.string().trim().max(5000).nullish(),
  countryOfOrigin: z.string().trim().max(80).nullish(),
  certifications: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  currency: z.string().trim().length(3).toUpperCase().default("USD"),
  retailPrice: moneyNullable.optional(),
  wholesalePrice: moneyNullable.optional(),
  minimumOrderQuantity: z.coerce.number().int().min(0).nullish(),
  isRetailAvailable: z.boolean().default(true),
  isWholesaleAvailable: z.boolean().default(false),
  stockQuantity: z.coerce.number().int().min(0).default(0),
  stockSyncEnabled: z.boolean().default(true),
  isPublished: z.boolean().default(false),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

/** Manual stock override — always sets stockSource = MANUAL. */
export const updateStockSchema = z.object({
  stockQuantity: z.coerce.number().int().min(0),
  stockSyncEnabled: z.boolean().optional(),
  note: z.string().trim().max(300).optional(),
});
export type UpdateStockInput = z.infer<typeof updateStockSchema>;

/* --------------------------------- variant ------------------------------- */

export const createVariantSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sku: z.string().trim().min(1).max(64),
  barcode: z.string().trim().max(64).nullish(),
  retailPrice: moneyNullable.optional(),
  wholesalePrice: moneyNullable.optional(),
  minimumOrderQuantity: z.coerce.number().int().min(0).nullish(),
  stockQuantity: z.coerce.number().int().min(0).default(0),
  weightGrams: z.coerce.number().int().min(0).nullish(),
  isActive: z.boolean().default(true),
  position: z.coerce.number().int().min(0).default(0),
});
export const updateVariantSchema = createVariantSchema.partial();

/* ---------------------------------- image -------------------------------- */
// Phase 2 stores an image URL only. Binary upload + object storage is a
// separate concern flagged for a later pass.

export const createImageSchema = z.object({
  url: z.string().url().max(1000),
  altText: z.string().trim().max(200).nullish(),
  position: z.coerce.number().int().min(0).default(0),
  isPrimary: z.boolean().default(false),
});
export const updateImageSchema = createImageSchema.partial();
