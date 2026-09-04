import { Router } from "express";
import { asyncHandler } from "../lib/async-handler.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import { rateLimit } from "../lib/rate-limit.js";
import * as ctrl from "../controllers/public.controller.js";
import {
  checkoutSchema,
  publicListProductsQuery,
  publicQuoteSchema,
  publicWholesaleApplicationSchema,
  trackOrderQuery,
} from "../validators/public.schema.js";

/**
 * /api/v1/public — unauthenticated storefront API. No bearer token, no cookies.
 * The storefront origin(s) must be listed in CORS_ORIGINS.
 *
 *   GET  /public/products                       published retail catalogue (filter/sort/paginate)
 *   GET  /public/products/:slug                 one published product (variants + images)
 *   GET  /public/content/faqs                   published FAQs, ordered
 *   GET  /public/content/testimonials           published testimonials, ordered
 *   GET  /public/content/recipes                published recipes (summaries)
 *   GET  /public/content/recipes/:slug          one recipe + resolved related products
 *   GET  /public/content/featured               homepage featured products
 *   GET  /public/orders/:orderNumber?email=     order tracking (email must match)
 *   POST /public/checkout                       create Order (PENDING_PAYMENT) + payment init
 *   POST /public/checkout/:reference/confirm-dev  [dev only] simulate payment success
 *   POST /public/payments/stripe/webhook        Stripe payment_intent.succeeded -> PAID
 *   POST /public/quotes                         wholesale quote request (-> REQUESTED)
 *   POST /public/wholesale-applications         wholesale account intake (-> PENDING)
 *
 * All mutations append to audit_logs with actorId = null (system).
 */
export const publicRouter = Router();

// Baseline throttle for every public route (per client IP; trust proxy is set).
publicRouter.use(rateLimit({ windowMs: 60_000, max: 120 }));

// Stricter throttle for the write endpoints (checkout + form submissions).
const writeLimit = rateLimit({ windowMs: 60_000, max: 8 });

/* ------------------------------- reads -------------------------------- */

publicRouter.get(
  "/products",
  validateQuery(publicListProductsQuery),
  asyncHandler(ctrl.listPublicProducts),
);
publicRouter.get("/products/:slug", asyncHandler(ctrl.getPublicProduct));

publicRouter.get("/content/faqs", asyncHandler(ctrl.listPublicFaqs));
publicRouter.get("/content/testimonials", asyncHandler(ctrl.listPublicTestimonials));
publicRouter.get("/content/recipes", asyncHandler(ctrl.listPublicRecipes));
publicRouter.get("/content/recipes/:slug", asyncHandler(ctrl.getPublicRecipe));
publicRouter.get("/content/featured", asyncHandler(ctrl.listPublicFeatured));

publicRouter.get(
  "/orders/:orderNumber",
  validateQuery(trackOrderQuery),
  asyncHandler(ctrl.trackPublicOrder),
);

/* ------------------------------- writes ------------------------------- */

publicRouter.post(
  "/checkout",
  writeLimit,
  validateBody(checkoutSchema),
  asyncHandler(ctrl.createCheckout),
);
publicRouter.post(
  "/checkout/:reference/confirm-dev",
  writeLimit,
  asyncHandler(ctrl.confirmCheckoutDev),
);
// No rate limit / validation middleware: Stripe calls this directly and the
// controller verifies the signature over the raw body.
publicRouter.post("/payments/stripe/webhook", asyncHandler(ctrl.stripeWebhook));

publicRouter.post(
  "/quotes",
  writeLimit,
  validateBody(publicQuoteSchema),
  asyncHandler(ctrl.createPublicQuote),
);
publicRouter.post(
  "/wholesale-applications",
  writeLimit,
  validateBody(publicWholesaleApplicationSchema),
  asyncHandler(ctrl.createPublicWholesaleApplication),
);
