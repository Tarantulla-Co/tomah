import { Router } from "express";
import { asyncHandler } from "../lib/async-handler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import * as ctrl from "../controllers/content.controller.js";
import {
  createFaqSchema,
  createFeaturedSchema,
  createRecipeSchema,
  createTestimonialSchema,
  listContentQuery,
  reorderFeaturedSchema,
  updateFaqSchema,
  updateFeaturedSchema,
  updateRecipeSchema,
  updateTestimonialSchema,
} from "../validators/content.schema.js";

/**
 * /api/v1/content  — storefront CMS copy.
 *   Reads  — any authenticated staff member.
 *   Writes — CONTENT_EDITOR (ADMIN implicit). All mutations append to audit_logs.
 *
 *   {faqs,testimonials,recipes}:
 *     GET    /content/<type>            list + search + paginate (+ counts {published,draft})
 *     POST   /content/<type>            create
 *     PATCH  /content/<type>/:id        update (partial)
 *     DELETE /content/<type>/:id        delete
 *
 *   featured (homepage featured-product selection):
 *     GET    /content/featured          ordered list (with product summary)
 *     POST   /content/featured          add   body: { productId, position?, note? }
 *     PATCH  /content/featured/reorder  body: { ids: [...] }  (full order)
 *     PATCH  /content/featured/:id      update position / note
 *     DELETE /content/featured/:id      remove
 */
export const contentRouter = Router();

const canRead = [requireAuth];
const canEdit = [requireAuth, requireRole("CONTENT_EDITOR")];

/* faqs */
contentRouter.get("/faqs", ...canRead, validateQuery(listContentQuery), asyncHandler(ctrl.listFaqs));
contentRouter.post("/faqs", ...canEdit, validateBody(createFaqSchema), asyncHandler(ctrl.createFaq));
contentRouter.patch("/faqs/:id", ...canEdit, validateBody(updateFaqSchema), asyncHandler(ctrl.updateFaq));
contentRouter.delete("/faqs/:id", ...canEdit, asyncHandler(ctrl.deleteFaq));

/* testimonials */
contentRouter.get("/testimonials", ...canRead, validateQuery(listContentQuery), asyncHandler(ctrl.listTestimonials));
contentRouter.post("/testimonials", ...canEdit, validateBody(createTestimonialSchema), asyncHandler(ctrl.createTestimonial));
contentRouter.patch("/testimonials/:id", ...canEdit, validateBody(updateTestimonialSchema), asyncHandler(ctrl.updateTestimonial));
contentRouter.delete("/testimonials/:id", ...canEdit, asyncHandler(ctrl.deleteTestimonial));

/* recipes */
contentRouter.get("/recipes", ...canRead, validateQuery(listContentQuery), asyncHandler(ctrl.listRecipes));
contentRouter.post("/recipes", ...canEdit, validateBody(createRecipeSchema), asyncHandler(ctrl.createRecipe));
contentRouter.patch("/recipes/:id", ...canEdit, validateBody(updateRecipeSchema), asyncHandler(ctrl.updateRecipe));
contentRouter.delete("/recipes/:id", ...canEdit, asyncHandler(ctrl.deleteRecipe));

/* featured products */
contentRouter.get("/featured", ...canRead, asyncHandler(ctrl.listFeatured));
contentRouter.post("/featured", ...canEdit, validateBody(createFeaturedSchema), asyncHandler(ctrl.createFeatured));
contentRouter.patch("/featured/reorder", ...canEdit, validateBody(reorderFeaturedSchema), asyncHandler(ctrl.reorderFeatured));
contentRouter.patch("/featured/:id", ...canEdit, validateBody(updateFeaturedSchema), asyncHandler(ctrl.updateFeatured));
contentRouter.delete("/featured/:id", ...canEdit, asyncHandler(ctrl.deleteFeatured));
