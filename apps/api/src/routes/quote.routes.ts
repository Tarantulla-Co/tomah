import { Router } from "express";
import { asyncHandler } from "../lib/async-handler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import * as ctrl from "../controllers/quote.controller.js";
import {
  approveQuoteSchema,
  convertQuoteSchema,
  createQuoteSchema,
  listQuotesQuery,
  quoteLineItemSchema,
  rejectQuoteSchema,
  sendQuoteSchema,
  updateQuoteLineItemSchema,
  updateQuoteSchema,
} from "../validators/quote.schema.js";

/**
 * /api/v1/quotes  — ORDER_MANAGER (ADMIN implicit).
 *
 *   GET    /                       list: status filter + search + paginate (+ statusCounts)
 *   POST   /                       create a quote (links/creates the customer, DRAFT)
 *   GET    /:id                    quote + line items + audit trail
 *   PATCH  /:id                    header fields (REQUESTED/DRAFT only)
 *   POST   /:id/line-items         add a line               (REQUESTED/DRAFT only)
 *   PATCH  /:id/line-items/:lineId update a line / price it  (REQUESTED/DRAFT only)
 *   DELETE /:id/line-items/:lineId remove a line            (REQUESTED/DRAFT only)
 *   POST   /:id/send               DRAFT -> SENT (all lines must be priced)
 *   POST   /:id/approve            SENT  -> APPROVED (records customer approval)
 *   POST   /:id/reject             -> REJECTED                body: { rejectionReason }
 *   POST   /:id/convert            APPROVED -> a DRAFT Invoice; quote -> CONVERTED
 */
export const quoteRouter = Router();

const guard = [requireAuth, requireRole("ORDER_MANAGER")];

quoteRouter.get("/", ...guard, validateQuery(listQuotesQuery), asyncHandler(ctrl.listQuotes));
quoteRouter.post("/", ...guard, validateBody(createQuoteSchema), asyncHandler(ctrl.createQuote));
quoteRouter.get("/:id", ...guard, asyncHandler(ctrl.getQuote));
quoteRouter.patch("/:id", ...guard, validateBody(updateQuoteSchema), asyncHandler(ctrl.updateQuote));

quoteRouter.post(
  "/:id/line-items",
  ...guard,
  validateBody(quoteLineItemSchema),
  asyncHandler(ctrl.addLineItem),
);
quoteRouter.patch(
  "/:id/line-items/:lineId",
  ...guard,
  validateBody(updateQuoteLineItemSchema),
  asyncHandler(ctrl.updateLineItem),
);
quoteRouter.delete("/:id/line-items/:lineId", ...guard, asyncHandler(ctrl.deleteLineItem));

quoteRouter.post("/:id/send", ...guard, validateBody(sendQuoteSchema), asyncHandler(ctrl.sendQuote));
quoteRouter.post("/:id/approve", ...guard, validateBody(approveQuoteSchema), asyncHandler(ctrl.approveQuote));
quoteRouter.post("/:id/reject", ...guard, validateBody(rejectQuoteSchema), asyncHandler(ctrl.rejectQuote));
quoteRouter.post("/:id/convert", ...guard, validateBody(convertQuoteSchema), asyncHandler(ctrl.convertQuote));
