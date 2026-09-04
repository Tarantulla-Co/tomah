import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 chars"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 chars"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  // Empty string => host-only cookie (correct when the web app proxies /api to
  // the API through a Vercel rewrite, so the cookie lands on the web origin).
  COOKIE_DOMAIN: z.string().default("localhost"),
  COOKIE_SECURE: z
    .string()
    .transform((v) => v === "true")
    .default("false"),
  // "lax" for same-origin / proxied deploys; "none" if the browser calls the
  // API on a different registrable domain than the web app (requires Secure).
  COOKIE_SAMESITE: z.enum(["lax", "none", "strict"]).default("lax"),

  CORS_ORIGINS: z.string().default("http://localhost:5173"),

  // --- asset storage (product images) ---
  STORAGE_ADAPTER: z.enum(["local", "supabase"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("uploads"),
  // Public base URL uploaded files are served from. Relative by default so it
  // works behind the dev proxy; set to an absolute CDN/bucket URL in prod.
  // For the "supabase" adapter this is derived automatically and may be left unset.
  ASSET_PUBLIC_BASE_URL: z.string().default("/uploads"),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(8),

  // Supabase Storage — required when STORAGE_ADAPTER=supabase.
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default("product-images"),

  // --- payments ---
  // "manual"  — no online collection; staff record payments on invoices/orders.
  // "stripe"  — live collection via Stripe PaymentIntents + webhook. Stripe's
  //             automatic payment methods surface Apple Pay / Google Pay / cards
  //             with no extra backend code.
  PAYMENT_PROVIDER: z.enum(["manual", "stripe"]).default("manual"),
  STRIPE_SECRET_KEY: z.string().optional(),
  // Safe to expose to the browser. Returned to the storefront in the checkout
  // response; falls back to the value stored in admin Settings if unset.
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  // Accounting-sync adapter. "noop" = nothing configured (Phase 8 wires real
  // adapters + settings).
  ACCOUNTING_ADAPTER: z.enum(["noop"]).default("noop"),
  // Default invoice payment terms, in days from the issue date.
  INVOICE_DUE_DAYS: z.coerce.number().int().positive().default(14),
}).superRefine((v, ctx) => {
  if (v.STORAGE_ADAPTER === "supabase") {
    if (!v.SUPABASE_URL) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["SUPABASE_URL"], message: "required when STORAGE_ADAPTER=supabase" });
    }
    if (!v.SUPABASE_SERVICE_ROLE_KEY) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["SUPABASE_SERVICE_ROLE_KEY"], message: "required when STORAGE_ADAPTER=supabase" });
    }
  }
  if (v.PAYMENT_PROVIDER === "stripe") {
    if (!v.STRIPE_SECRET_KEY) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["STRIPE_SECRET_KEY"], message: "required when PAYMENT_PROVIDER=stripe" });
    }
    if (!v.STRIPE_WEBHOOK_SECRET) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["STRIPE_WEBHOOK_SECRET"], message: "required when PAYMENT_PROVIDER=stripe" });
    }
  }
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("✖ Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === "production",
  corsOrigins: parsed.data.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean),
  REFRESH_COOKIE_NAME: "tomah_rt",
};
