/**
 * Payment-collection abstraction for retail orders and invoices.
 *
 * - "manual"  (online: false) — no network calls. Staff record a payment on the
 *   invoice/order (reference + date) which marks it PAID.
 * - "stripe"  (online: true)  — `initialize()` creates a Stripe PaymentIntent
 *   and returns its `clientSecret`; the storefront confirms it with Stripe.js
 *   (Payment Element → cards + Apple Pay + Google Pay). `parseWebhook()` turns a
 *   `payment_intent.succeeded` event into a `PaymentWebhookResult` the checkout
 *   controller uses to flip PENDING_PAYMENT → PAID.
 */
export interface PaymentInit {
  /** Major-unit decimal string, e.g. "1250.00". */
  amount: string;
  currency: string;
  /** Our idempotency key — the order or invoice number. */
  reference: string;
  customerEmail: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentInitResult {
  provider: string;
  reference: string;
  /** Provider-side id (Stripe PaymentIntent id). Persisted on the row. */
  providerReference: string | null;
  /** Stripe: PaymentIntent client secret for browser confirmation. */
  clientSecret: string | null;
  /** Redirect-style providers only (unused by Stripe / manual). */
  authorizationUrl: string | null;
}

export interface PaymentVerifyResult {
  reference: string;
  status: "success" | "pending" | "failed";
  paidAt: Date | null;
  /** Major-unit decimal string, or null if unknown. */
  amount: string | null;
}

export interface PaymentWebhookResult {
  /** false = event received but not one we act on (still ack with 200). */
  handled: boolean;
  /** Our order/invoice number, from PaymentIntent metadata. */
  reference: string | null;
  /** Provider-side id (PaymentIntent id). */
  providerReference: string | null;
  status: "success" | "pending" | "failed";
  paidAt: Date | null;
  /** Major-unit decimal string, or null if unknown. */
  amount: string | null;
}

export interface PaymentProvider {
  readonly name: string;
  /** `false` = stub; controllers collect payments manually only. */
  readonly online: boolean;
  initialize(input: PaymentInit): Promise<PaymentInitResult>;
  /** `reference` is the provider-side id (Stripe PaymentIntent id). */
  verify(reference: string): Promise<PaymentVerifyResult>;
  /**
   * Verify a raw webhook payload + signature and normalise it. Throws on an
   * invalid signature (the caller answers 400). `manual` throws "unsupported".
   */
  parseWebhook(rawBody: Buffer | undefined, signature: string | undefined): PaymentWebhookResult;
}
