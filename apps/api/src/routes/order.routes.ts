import { Router } from "express";
import { asyncHandler } from "../lib/async-handler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import * as ctrl from "../controllers/order.controller.js";
import {
  cancelOrderSchema,
  deliverOrderSchema,
  listOrdersQuery,
  refundOrderSchema,
  shipOrderSchema,
  updateOrderSchema,
} from "../validators/order.schema.js";

/**
 * /api/v1/orders  — ORDER_MANAGER (ADMIN implicit).
 *
 * Retail orders are created by the storefront at checkout (see docs/DATA_MODEL.md);
 * this API owns every status transition and fulfilment/refund action.
 *
 *   GET   /                    list: status/carrier filter + search + paginate (+ statusCounts)
 *   GET   /:id                 order + items + addresses + timeline + audit trail
 *   PATCH /:id                 correct carrier / tracking / internal note (not once terminal)
 *   POST  /:id/process         PAID -> PROCESSING
 *   POST  /:id/ship            PAID/PROCESSING -> SHIPPED   body: { carrier, trackingNumber, shippedAt? }
 *   POST  /:id/deliver         SHIPPED -> DELIVERED
 *   POST  /:id/cancel          PAID/PROCESSING -> CANCELLED  body: { reason }
 *   POST  /:id/refund          PAID/PROCESSING/SHIPPED/DELIVERED -> REFUNDED  body: { amount?, reason }
 */
export const orderRouter = Router();

const guard = [requireAuth, requireRole("ORDER_MANAGER")];

orderRouter.get("/", ...guard, validateQuery(listOrdersQuery), asyncHandler(ctrl.listOrders));
orderRouter.get("/:id", ...guard, asyncHandler(ctrl.getOrder));
orderRouter.patch("/:id", ...guard, validateBody(updateOrderSchema), asyncHandler(ctrl.updateOrder));

orderRouter.post("/:id/process", ...guard, asyncHandler(ctrl.processOrder));
orderRouter.post("/:id/ship", ...guard, validateBody(shipOrderSchema), asyncHandler(ctrl.shipOrder));
orderRouter.post("/:id/deliver", ...guard, validateBody(deliverOrderSchema), asyncHandler(ctrl.deliverOrder));
orderRouter.post("/:id/cancel", ...guard, validateBody(cancelOrderSchema), asyncHandler(ctrl.cancelOrder));
orderRouter.post("/:id/refund", ...guard, validateBody(refundOrderSchema), asyncHandler(ctrl.refundOrder));
