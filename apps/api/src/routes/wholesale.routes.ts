import { Router } from "express";
import { asyncHandler } from "../lib/async-handler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import * as ctrl from "../controllers/wholesale.controller.js";
import {
  approveSchema,
  createApplicationSchema,
  listWholesaleQuery,
  rejectSchema,
} from "../validators/wholesale.schema.js";

/**
 * /api/v1/wholesale-accounts  — ORDER_MANAGER (ADMIN implicit).
 *
 *   GET  /                     queue: filter by status, search, paginate (+ statusCounts)
 *   POST /                     log an offline application (creates/links a WHOLESALE customer)
 *   GET  /:id                  application + customer activity + audit trail
 *   POST /:id/approve          -> APPROVED (records reviewer + timestamp)   body: { reviewNotes? }
 *   POST /:id/reject           -> REJECTED / revoke access                  body: { rejectionReason, reviewNotes? }
 *
 * APPROVED status is the gate for wholesale-pricing visibility everywhere else
 * (see apps/api/src/lib/wholesale.ts).
 */
export const wholesaleRouter = Router();

const guard = [requireAuth, requireRole("ORDER_MANAGER")];

wholesaleRouter.get("/", ...guard, validateQuery(listWholesaleQuery), asyncHandler(ctrl.listAccounts));
wholesaleRouter.post("/", ...guard, validateBody(createApplicationSchema), asyncHandler(ctrl.createApplication));
wholesaleRouter.get("/:id", ...guard, asyncHandler(ctrl.getAccount));
wholesaleRouter.post("/:id/approve", ...guard, validateBody(approveSchema), asyncHandler(ctrl.approveAccount));
wholesaleRouter.post("/:id/reject", ...guard, validateBody(rejectSchema), asyncHandler(ctrl.rejectAccount));
