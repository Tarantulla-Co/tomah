import { Router } from "express";
import { asyncHandler } from "../lib/async-handler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import { singleImage } from "../middleware/upload.js";
import * as ctrl from "../controllers/product.controller.js";
import {
  createImageSchema,
  createProductSchema,
  createVariantSchema,
  listProductsQuery,
  updateImageSchema,
  updateProductSchema,
  updateStockSchema,
  updateVariantSchema,
} from "../validators/product.schema.js";

/**
 * /api/v1/products
 *   Reads  — any authenticated staff member.
 *   Writes — CONTENT_EDITOR (and ADMIN, implicitly).
 *
 *   GET    /                          list + filter + paginate (+ categoryCounts)
 *   POST   /                          create
 *   GET    /:id                       one product with variants + images
 *   PATCH  /:id                       update fields (NOT stock)
 *   DELETE /:id                       delete
 *   PATCH  /:id/stock                 manual stock override (stamps MANUAL)
 *   POST   /:id/variants             add size/packaging variant
 *   PATCH  /:id/variants/:variantId  update variant
 *   DELETE /:id/variants/:variantId  remove variant
 *   POST   /:id/images              add image by URL
 *   POST   /:id/images/upload       upload an image file (multipart, field `file`)
 *   PATCH  /:id/images/:imageId     update image
 *   DELETE /:id/images/:imageId     remove image (deletes the file if we host it)
 */
export const productRouter = Router();

const canEdit = [requireAuth, requireRole("CONTENT_EDITOR")];

productRouter.get("/", requireAuth, validateQuery(listProductsQuery), asyncHandler(ctrl.listProducts));
productRouter.get("/:id", requireAuth, asyncHandler(ctrl.getProduct));

productRouter.post("/", ...canEdit, validateBody(createProductSchema), asyncHandler(ctrl.createProduct));
productRouter.patch("/:id", ...canEdit, validateBody(updateProductSchema), asyncHandler(ctrl.updateProduct));
productRouter.delete("/:id", ...canEdit, asyncHandler(ctrl.deleteProduct));

productRouter.patch("/:id/stock", ...canEdit, validateBody(updateStockSchema), asyncHandler(ctrl.updateStock));

productRouter.post("/:id/variants", ...canEdit, validateBody(createVariantSchema), asyncHandler(ctrl.addVariant));
productRouter.patch(
  "/:id/variants/:variantId",
  ...canEdit,
  validateBody(updateVariantSchema),
  asyncHandler(ctrl.updateVariant),
);
productRouter.delete("/:id/variants/:variantId", ...canEdit, asyncHandler(ctrl.deleteVariant));

productRouter.post("/:id/images", ...canEdit, validateBody(createImageSchema), asyncHandler(ctrl.addImage));
productRouter.post("/:id/images/upload", ...canEdit, singleImage, asyncHandler(ctrl.uploadImage));
productRouter.patch(
  "/:id/images/:imageId",
  ...canEdit,
  validateBody(updateImageSchema),
  asyncHandler(ctrl.updateImage),
);
productRouter.delete("/:id/images/:imageId", ...canEdit, asyncHandler(ctrl.deleteImage));
