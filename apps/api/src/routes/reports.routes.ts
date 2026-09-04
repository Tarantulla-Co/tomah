import { Router } from "express";
import { asyncHandler } from "../lib/async-handler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateQuery } from "../middleware/validate.js";
import * as ctrl from "../controllers/reports.controller.js";
import { reportRangeQuery, topProductsQuery } from "../validators/settings.schema.js";

/**
 * /api/v1/reports  — ADMIN only (sensitive financial data; Phase 1 deliberately
 * kept revenue out of /overview and deferred it to here, role-scoped).
 *
 *   GET /reports/summary?from=&to=        revenue by channel + KPIs + monthly series
 *   GET /reports/top-products?from=&to=&limit=   best sellers by order revenue
 *
 * `from` / `to` are YYYY-MM-DD; default window is the last 30 days.
 */
export const reportsRouter = Router();

const admin = [requireAuth, requireRole()];

reportsRouter.get("/summary", ...admin, validateQuery(reportRangeQuery), asyncHandler(ctrl.getSummary));
reportsRouter.get("/top-products", ...admin, validateQuery(topProductsQuery), asyncHandler(ctrl.getTopProducts));
