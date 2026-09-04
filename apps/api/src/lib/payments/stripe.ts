import Stripe from "stripe";
import { HttpError } from "../http-error.js";
import type {
  PaymentInit,
  PaymentInitResult,
  PaymentProvider,
  PaymentVerifyResult,
  PaymentWebhookResult,
} from "./types.js";

// ISO 4217 currencies with no minor unit — amounts are whole numbers.
const ZERO_DECIMAL = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG",
  "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);

function toMinorUnits(amount: string, currency: string): number {
  const cur = currency.toUpperCase();
  const value = Number(amount);
  if (!Number.isFinite(value)) throw new Error(`Bad amount: ${amount}`);
  return ZERO_DECIMAL.has(cur) ? Math.round(value) : Math.round(value * 100);
}

function fromMinorUnits(minor: number, currency: string): string {
  const cur = currency.toUpperCase();
  return ZERO_DECIMAL.has(cur) ? String(minor) : (minor / 100).toFixed(2);
}

const STATUS_MAP: Record<string, PaymentVerifyResult["status"]> = {
  succeeded: "success",
  processing: "pending",
  requires_payment_method: "pending",
  requires_confirmation: "pending",
  requires_action: "pending",
  requires_capture: "pending",
  canceled: "failed",
};

export class StripeProvider implements PaymentProvider {
  readonly name = "stripe";
  readonly online = true;
  private readonly stripe: Stripe;

  constructor(
    secretKey: string,
    private readonly webhookSecret: string,
  ) {
    // No apiVersion override — the SDK uses the version it was built against.
    this.stripe = new Stripe(secretKey);
  }

  async initialize(input: PaymentInit): Promise<PaymentInitResult> {
    const intent = await this.stripe.paymentIntents.create(
      {
        amount: toMinorUnits(input.amount, input.currency),
        currency: input.currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        receipt_email: input.customerEmail,
        description: `Tomah order ${input.reference}`,
        metadata: {
          ...toStringMap(input.metadata),
          reference: input.reference,
        },
      },
      { idempotencyKey: `init_${input.reference}` },
    );

    return {
      provider: this.name,
      reference: input.reference,
      providerReference: intent.id,
      clientSecret: intent.client_secret,
      authorizationUrl: null,
    };
  }

  async verify(reference: string): Promise<PaymentVerifyResult> {
    const intent = await this.stripe.paymentIntents.retrieve(reference);
    return {
      reference,
      status: STATUS_MAP[intent.status] ?? "pending",
      paidAt: intent.status === "succeeded" ? new Date() : null,
      amount:
        intent.amount_received != null
          ? fromMinorUnits(intent.amount_received, intent.currency)
          : null,
    };
  }

  parseWebhook(
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ): PaymentWebhookResult {
    if (!rawBody || !signature) {
      throw new HttpError(400, "Missing webhook body or signature", "BAD_REQUEST");
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch (err) {
      throw new HttpError(
        400,
        `Webhook signature verification failed: ${(err as Error).message}`,
        "BAD_REQUEST",
      );
    }

    if (event.type !== "payment_intent.succeeded") {
      return {
        handled: false,
        reference: null,
        providerReference: null,
        status: "pending",
        paidAt: null,
        amount: null,
      };
    }

    const intent = event.data.object as Stripe.PaymentIntent;
    return {
      handled: true,
      reference: (intent.metadata?.reference as string | undefined) ?? null,
      providerReference: intent.id,
      status: "success",
      paidAt: new Date((event.created ?? Math.floor(Date.now() / 1000)) * 1000),
      amount: fromMinorUnits(intent.amount_received ?? intent.amount, intent.currency),
    };
  }
}

function toStringMap(input: Record<string, unknown> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input ?? {})) {
    if (v != null) out[k] = String(v);
  }
  return out;
}
