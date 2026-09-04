import { env } from "../../config/env.js";
import { manualProvider } from "./manual.js";
import { StripeProvider } from "./stripe.js";
import type { PaymentProvider } from "./types.js";

export type {
  PaymentProvider,
  PaymentInit,
  PaymentInitResult,
  PaymentVerifyResult,
  PaymentWebhookResult,
} from "./types.js";

function build(): PaymentProvider {
  if (env.PAYMENT_PROVIDER === "stripe" && env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET) {
    return new StripeProvider(env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET);
  }
  // "manual", or "stripe" selected without keys (env validation already blocks
  // the latter, but stay safe).
  return manualProvider;
}

export const payments: PaymentProvider = build();
