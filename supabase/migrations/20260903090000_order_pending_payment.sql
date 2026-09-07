-- AlterEnum
-- Storefront checkout writes an Order before payment is confirmed. This adds the
-- pre-payment state; the admin dashboard filters it out until the payment
-- webhook flips the order to PAID.
ALTER TYPE "OrderStatus" ADD VALUE 'PENDING_PAYMENT' BEFORE 'PAID';
