import { z } from "zod";

export const WHOLESALE_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

export const listWholesaleQuery = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(WHOLESALE_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(["createdAt", "-createdAt", "businessName", "-businessName"]).default("-createdAt"),
});
export type ListWholesaleQuery = z.infer<typeof listWholesaleQuery>;

/**
 * Admin-side application intake (offline applications keyed in by staff). The
 * storefront submits the same shape to its own endpoint. Creates/links a
 * WHOLESALE Customer by email.
 */
export const createApplicationSchema = z.object({
  // applicant / customer
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().email().toLowerCase().trim(),
  phone: z.string().trim().max(40).nullish(),

  // business
  businessName: z.string().trim().min(1).max(200),
  businessRegistrationNumber: z.string().trim().max(120).nullish(),
  taxId: z.string().trim().max(120).nullish(),
  businessType: z.string().trim().max(120).nullish(),
  website: z.string().trim().max(300).nullish(),
  estimatedMonthlyVolume: z.string().trim().max(120).nullish(),
  applicationNotes: z.string().trim().max(2000).nullish(),
});
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;

export const approveSchema = z.object({
  reviewNotes: z.string().trim().max(2000).optional(),
});

export const rejectSchema = z.object({
  rejectionReason: z.string().trim().min(1, "A reason is required").max(2000),
  reviewNotes: z.string().trim().max(2000).optional(),
});
