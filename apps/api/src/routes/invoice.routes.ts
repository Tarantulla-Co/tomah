import { Router } from "express";
import { asyncHandler } from "../lib/async-handler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import * as ctrl from "../controllers/invoice.controller.js";
import {
  createInvoiceSchema,
  invoiceLineItemSchema,
  listInvoicesQuery,
  recordPaymentSchema,
  sendInvoiceSchema,
  updateInvoiceLineItemSchema,
  updateInvoiceSchema,
  voidInvoiceSchema,
} from "../validators/invoice.schema.js";

/**
 * /api/v1/invoices  — ORDER_MANAGER (ADMIN implicit).
 *
 * Invoices are normally born from POST /quotes/:id/convert; POST / here is for a
 * direct, quote-less invoice.
 *
 *   GET    /                       list: status filter + search + paginate (+ statusCounts)
 *   POST   /                       create a standalone invoice (DRAFT)
 *   GET    /:id                    invoice + line items + audit trail
 *   PATCH  /:id                    header fields (DRAFT only)
 *   POST   /:id/line-items         add a line               (DRAFT only)
 *   PATCH  /:id/line-items/:lineId update a line            (DRAFT only)
 *   DELETE /:id/line-items/:lineId remove a line            (DRAFT only)
 *   POST   /:id/send               DRAFT -> SENT
 *   POST   /:id/pay                record a received payment -> PAID (+ accounting push)
 *   POST   /:id/void               -> VOID (not from PAID)
 */
export const invoiceRouter = Router();

const guard = [requireAuth, requireRole("ORDER_MANAGER")];

invoiceRouter.get("/", ...guard, validateQuery(listInvoicesQuery), asyncHandler(ctrl.listInvoices));
invoiceRouter.post("/", ...guard, validateBody(createInvoiceSchema), asyncHandler(ctrl.createInvoice));
invoiceRouter.get("/:id", ...guard, asyncHandler(ctrl.getInvoice));
invoiceRouter.patch("/:id", ...guard, validateBody(updateInvoiceSchema), asyncHandler(ctrl.updateInvoice));

invoiceRouter.post(
  "/:id/line-items",
  ...guard,
  validateBody(invoiceLineItemSchema),
  asyncHandler(ctrl.addLineItem),
);
invoiceRouter.patch(
  "/:id/line-items/:lineId",
  ...guard,
  validateBody(updateInvoiceLineItemSchema),
  asyncHandler(ctrl.updateLineItem),
);
invoiceRouter.delete("/:id/line-items/:lineId", ...guard, asyncHandler(ctrl.deleteLineItem));

invoiceRouter.post("/:id/send", ...guard, validateBody(sendInvoiceSchema), asyncHandler(ctrl.sendInvoice));
invoiceRouter.post("/:id/pay", ...guard, validateBody(recordPaymentSchema), asyncHandler(ctrl.recordPayment));
invoiceRouter.post("/:id/void", ...guard, validateBody(voidInvoiceSchema), asyncHandler(ctrl.voidInvoice));
