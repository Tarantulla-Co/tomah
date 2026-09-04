import { Router } from "express";
import { asyncHandler } from "../lib/async-handler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateQuery } from "../middleware/validate.js";
import * as ctrl from "../controllers/customer.controller.js";
import { listCustomersQuery } from "../validators/customer.schema.js";

/**
 * /api/v1/customers  — ORDER_MANAGER (ADMIN implicit). Read-only in Phase 6:
 * a unified retail + wholesale directory. Customer records themselves are
 * written by the storefront at checkout / application intake.
 *
 *   GET /            list: type filter + search + paginate (+ typeCounts, per-row counts)
 *   GET /:id         profile: wholesale account, addresses, recent orders /
 *                    quotes / invoices, and lifetime stats
 */
export const customerRouter = Router();

const guard = [requireAuth, requireRole("ORDER_MANAGER")];

customerRouter.get("/", ...guard, validateQuery(listCustomersQuery), asyncHandler(ctrl.listCustomers));
customerRouter.get("/:id", ...guard, asyncHandler(ctrl.getCustomer));
