import { Router } from "express";
import { asyncHandler } from "../lib/async-handler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { authRouter } from "./auth.routes.js";
import { healthRouter } from "./health.routes.js";
import { publicRouter } from "./public.routes.js";
import { productRouter } from "./product.routes.js";
import { wholesaleRouter } from "./wholesale.routes.js";
import { quoteRouter } from "./quote.routes.js";
import { invoiceRouter } from "./invoice.routes.js";
import { orderRouter } from "./order.routes.js";
import { customerRouter } from "./customer.routes.js";
import { contentRouter } from "./content.routes.js";
import { settingsRouter } from "./settings.routes.js";
import { reportsRouter } from "./reports.routes.js";
import { getOverview } from "../controllers/overview.controller.js";
import { runAccountingSync } from "../controllers/settings.controller.js";

/** API v1 router. Mounted at /api/v1 by app.ts.
 *
 * Route map:
 *   GET  /healthz                 liveness
 *   GET  /readyz                  readiness (checks DB)
 *   POST /auth/login              email + password -> { user, accessToken } (+ refresh cookie)
 *   POST /auth/refresh            rotate refresh cookie -> new access token
 *   POST /auth/logout             revoke current refresh token
 *   POST /auth/logout-all   [A]   revoke all sessions for current user
 *   GET  /auth/me           [A]   current user
 *   *    /public                  unauthenticated storefront API (see public.routes.ts)
 *   GET  /overview          [A]   dashboard counts
 *   *    /products          [A]   product catalogue (see product.routes.ts)
 *   *    /wholesale-accounts [A]  application queue (see wholesale.routes.ts)
 *   *    /quotes            [A]   wholesale quotes + quote->invoice (see quote.routes.ts)
 *   *    /invoices          [A]   invoicing + payment recording (see invoice.routes.ts)
 *   *    /orders            [A]   retail order fulfilment + refunds (see order.routes.ts)
 *   *    /customers         [A]   unified retail + wholesale directory (see customer.routes.ts)
 *   *    /content           [A]   storefront CMS: faqs/testimonials/recipes/featured (see content.routes.ts)
 *   *    /settings          [ADMIN] payment/shipping/tax/accounting config (see settings.routes.ts)
 *   POST /accounting/sync  [ADMIN] manual push of paid invoices to the accounting adapter
 *   *    /reports           [ADMIN] revenue-by-channel, top products (see reports.routes.ts)
 *
 * [A] = requires a valid access token. [ADMIN] = requires the ADMIN role.
 */
export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use("/public", publicRouter);
apiRouter.use("/auth", authRouter);
apiRouter.get("/overview", requireAuth, asyncHandler(getOverview));
apiRouter.use("/products", productRouter);
apiRouter.use("/wholesale-accounts", wholesaleRouter);
apiRouter.use("/quotes", quoteRouter);
apiRouter.use("/invoices", invoiceRouter);
apiRouter.use("/orders", orderRouter);
apiRouter.use("/customers", customerRouter);
apiRouter.use("/content", contentRouter);
apiRouter.use("/settings", settingsRouter);
apiRouter.post("/accounting/sync", requireAuth, requireRole(), asyncHandler(runAccountingSync));
apiRouter.use("/reports", reportsRouter);
