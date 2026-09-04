import { HttpError } from "../http-error.js";
import type { PaymentProvider } from "./types.js";

/**
 * No-collection provider. Makes no network calls — `online: false` means the
 * invoice/order controllers only accept *recorded* payments (staff enters a
 * reference once the money is received). Selected with PAYMENT_PROVIDER=manual
 * (the default) or whenever Stripe keys are absent.
 */
export const manualProvider: PaymentProvider = {
  name: "manual",
  online: false,
  async initialize() {
    throw new Error(
      "Online collection is disabled (PAYMENT_PROVIDER=manual). Record the payment " +
        "manually once received, or set PAYMENT_PROVIDER=stripe.",
    );
  },
  async verify(reference) {
    return { reference, status: "pending", paidAt: null, amount: null };
  },
  parseWebhook() {
    throw new HttpError(
      501,
      "No payment webhook to handle (PAYMENT_PROVIDER=manual).",
      "NOT_IMPLEMENTED",
    );
  },
};
