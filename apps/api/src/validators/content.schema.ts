import { z } from "zod";
import { paginationQuery } from "./common.js";

/* --------------------------------- shared -------------------------------- */

export const listContentQuery = paginationQuery.extend({
  status: z.enum(["published", "draft"]).optional(),
  sort: z.enum(["position", "-position", "updatedAt", "-updatedAt"]).default("position"),
});
export type ListContentQuery = z.infer<typeof listContentQuery>;

const position = z.coerce.number().int().min(0).optional();
const isPublished = z.boolean().optional();

/* ---------------------------------- FAQ --------------------------------- */

export const createFaqSchema = z.object({
  question: z.string().trim().min(1).max(500),
  answer: z.string().trim().min(1).max(5000),
  category: z.string().trim().max(80).nullish(),
  position,
  isPublished,
});
export const updateFaqSchema = createFaqSchema.partial();
export type CreateFaqInput = z.infer<typeof createFaqSchema>;

/* ------------------------------ testimonial --------------------------- */

export const createTestimonialSchema = z.object({
  authorName: z.string().trim().min(1).max(120),
  authorTitle: z.string().trim().max(160).nullish(),
  quote: z.string().trim().min(1).max(2000),
  rating: z.coerce.number().int().min(1).max(5).nullish(),
  position,
  isPublished,
});
export const updateTestimonialSchema = createTestimonialSchema.partial();
export type CreateTestimonialInput = z.infer<typeof createTestimonialSchema>;

/* -------------------------------- recipe ------------------------------ */

export const createRecipeSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z.string().trim().max(80).optional(),
  summary: z.string().trim().max(500).nullish(),
  ingredients: z.array(z.string().trim().min(1).max(300)).max(100).default([]),
  steps: z.array(z.string().trim().min(1).max(2000)).max(100).default([]),
  imageUrl: z.string().trim().url().max(1000).nullish(),
  relatedProductIds: z.array(z.string().uuid()).max(50).default([]),
  position,
  isPublished,
});
export const updateRecipeSchema = createRecipeSchema.partial();
export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;

/* ---------------------------- featured product ----------------------- */

export const createFeaturedSchema = z.object({
  productId: z.string().uuid(),
  position,
  note: z.string().trim().max(300).nullish(),
});
export const updateFeaturedSchema = z.object({
  position,
  note: z.string().trim().max(300).nullish(),
});
export const reorderFeaturedSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});
export type CreateFeaturedInput = z.infer<typeof createFeaturedSchema>;
