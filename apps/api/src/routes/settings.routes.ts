import { Router } from "express";
import { asyncHandler } from "../lib/async-handler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import * as ctrl from "../controllers/settings.controller.js";
import {
  updateAccountingSchema,
  updatePaymentsSchema,
  updateShippingSchema,
  updateTaxSchema,
} from "../validators/settings.schema.js";

/**
 * /api/v1/settings  — ADMIN only (sensitive config).
 *
 *   GET   /settings                 all four groups (payments secret redacted)
 *   GET   /settings/:group          one group
 *   PATCH /settings/payments        { publicKey?, secretKey? (write-only, "" clears), testMode? }
 *   PATCH /settings/shipping        { freeShippingThreshold?, defaultFee?, rules? [{ region, fee }] }
 *   PATCH /settings/tax             { defaultRate?, rules? [{ region, rate }] }
 *   PATCH /settings/accounting      { autoSyncOnPayment? }
 */
export const settingsRouter = Router();

const admin = [requireAuth, requireRole()];

settingsRouter.get("/", ...admin, asyncHandler(ctrl.getSettings));
settingsRouter.get("/:group", ...admin, asyncHandler(ctrl.getSettingsGroup));
settingsRouter.patch("/payments", ...admin, validateBody(updatePaymentsSchema), asyncHandler(ctrl.updatePayments));
settingsRouter.patch("/shipping", ...admin, validateBody(updateShippingSchema), asyncHandler(ctrl.updateShipping));
settingsRouter.patch("/tax", ...admin, validateBody(updateTaxSchema), asyncHandler(ctrl.updateTax));
settingsRouter.patch("/accounting", ...admin, validateBody(updateAccountingSchema), asyncHandler(ctrl.updateAccounting));
