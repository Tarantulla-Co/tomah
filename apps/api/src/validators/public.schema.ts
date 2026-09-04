import { z } from "zod";
import { PRODUCT_CATEGORIES } from "./product.schema.js";

/**
 * Request schemas for the unauthenticated storefront API (`/api/v1/public`).
 * These are deliberately separate from the admin schemas: the storefront never
 * sends staff-only fields, and every write carries a `botField` honeypot that a
 * real client leaves empty.
 */

const categoryEnum = z.enum(PRODUCT_CATEGORIES);

/** Hidden form field — must arrive empty. A filled value is almost always a bot. */
const honeypot = z.string().max(0, "rejected").optional();

/* --------------------------------- catalogue ---------------------------- */

export const publicListProductsQuery = z.object({
  q: z.string().trim().max(120).optional(),
  category: categoryEnum.optional(),
  sort: z.enum(["newest", "name", "-name", "price", "-price"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(24),
});
export type PublicListProductsQuery = z.infer<typeof publicListProductsQuery>;

/* ------------------------------ shared inputs -------------------------- */

const contactInput = z.object({
  email: z.string().email().toLowerCase().trim(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(40).nullish(),
});

const addressInput = z.object({
  contactName: z.string().trim().min(1).max(120),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).nullish(),
  city: z.string().trim().min(1).max(120),
  region: z.string().trim().min(1).max(120), // state / province
  postalCode: z.string().trim().min(1).max(40),
  country: z.string().trim().length(2).toUpperCase().default("US"), // ISO 3166-1 alpha-2
  phone: z.string().trim().max(40).nullish(),
});
export type PublicAddressInput = z.infer<typeof addressInput>;

/* --------------------------------- checkout ---------------------------- */

export const checkoutSchema = z.object({
  botField: honeypot,
  customer: contactInput,
  shippingAddress: addressInput,
  billingAddress: addressInput.optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        variantId: z.string().uuid().nullish(),
        quantity: z.coerce.number().int().min(1).max(999),
      }),
    )
    .min(1, "Your cart is empty")
    .max(100),
  currency: z.string().trim().length(3).toUpperCase().default("USD"),
  customerNote: z.string().trim().max(2000).nullish(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

/* ------------------------------ order tracking ----------------------- */

export const trackOrderQuery = z.object({
  email: z.string().email().toLowerCase().trim(),
});
export type TrackOrderQuery = z.infer<typeof trackOrderQuery>;

/* ---------------------------- wholesale quote req ------------------- */

export const publicQuoteSchema = z.object({
  botField: honeypot,
  company: z.string().trim().max(200).nullish(),
  contact: contactInput,
  items: z
    .array(
      z.object({
        productId: z.string().uuid().nullish(),
        variantId: z.string().uuid().nullish(),
        description: z.string().trim().min(1).max(500).nullish(),
        quantity: z.coerce.number().int().min(1).max(1_000_000),
        note: z.string().trim().max(500).nullish(),
      }),
    )
    .min(1, "Add at least one product to request a quote")
    .max(100),
  message: z.string().trim().max(2000).nullish(),
});
export type PublicQuoteInput = z.infer<typeof publicQuoteSchema>;

/* ------------------------ wholesale application -------------------- */

export const publicWholesaleApplicationSchema = z.object({
  botField: honeypot,
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().email().toLowerCase().trim(),
  phone: z.string().trim().max(40).nullish(),
  businessName: z.string().trim().min(1).max(200),
  businessRegistrationNumber: z.string().trim().max(120).nullish(),
  taxId: z.string().trim().max(120).nullish(),
  businessType: z.string().trim().max(120).nullish(),
  website: z.string().trim().max(300).nullish(),
  estimatedMonthlyVolume: z.string().trim().max(120).nullish(),
  applicationNotes: z.string().trim().max(2000).nullish(),
});
export type PublicWholesaleApplicationInput = z.infer<typeof publicWholesaleApplicationSchema>;
