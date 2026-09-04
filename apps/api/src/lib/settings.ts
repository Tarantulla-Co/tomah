import { prisma, Prisma } from "@tomah/db";
import { env } from "../config/env.js";
import { accounting } from "./accounting/index.js";
import { payments } from "./payments/index.js";

export type SettingGroup = "payments" | "shipping" | "tax" | "accounting";
export const SETTING_GROUPS: SettingGroup[] = ["payments", "shipping", "tax", "accounting"];

/* --------------------------------- shapes ------------------------------- */

export interface PaymentsSettings {
  provider: string;
  online: boolean; // whether the configured provider does live collection
  publicKey: string | null;
  secretKeySet: boolean;
  testMode: boolean;
}

export interface ShippingRule {
  region: string; // ISO region / state code or free text
  fee: string; // decimal string
}
export interface ShippingSettings {
  freeShippingThreshold: string | null;
  defaultFee: string;
  rules: ShippingRule[];
}

export interface TaxRule {
  region: string;
  rate: number; // 0..1
}
export interface TaxSettings {
  defaultRate: number;
  rules: TaxRule[];
}

export interface AccountingSettings {
  adapter: string;
  connected: boolean;
  autoSyncOnPayment: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: "success" | "partial" | "failed" | null;
  lastSyncSummary: string | null;
}

/* ------------------------------- defaults ----------------------------- */
// What each group holds *in the DB* (payments keeps the secret here; it is
// never returned — see toPublic).

const STORED_DEFAULTS: Record<SettingGroup, Record<string, unknown>> = {
  payments: { publicKey: null, secretKey: null, testMode: true },
  shipping: { freeShippingThreshold: null, defaultFee: "0.00", rules: [] },
  tax: { defaultRate: 0, rules: [] },
  accounting: {
    autoSyncOnPayment: false,
    lastSyncAt: null,
    lastSyncStatus: null,
    lastSyncSummary: null,
  },
};

/* ------------------------------- read/write --------------------------- */

async function readStored(group: SettingGroup): Promise<Record<string, unknown>> {
  const row = await prisma.setting.findUnique({ where: { key: group } });
  const stored = (row?.value as Record<string, unknown> | undefined) ?? {};
  return { ...STORED_DEFAULTS[group], ...stored };
}

function toPublic(group: SettingGroup, stored: Record<string, unknown>): unknown {
  if (group === "payments") {
    return {
      provider: payments.name,
      online: payments.online,
      // Settings value wins; otherwise the env publishable key (Stripe).
      publicKey: (stored.publicKey as string | null) ?? env.STRIPE_PUBLISHABLE_KEY ?? null,
      secretKeySet: Boolean(stored.secretKey) || Boolean(env.STRIPE_SECRET_KEY),
      testMode: stored.testMode !== false,
    } satisfies PaymentsSettings;
  }
  if (group === "accounting") {
    return {
      adapter: accounting.name,
      connected: accounting.connected,
      autoSyncOnPayment: stored.autoSyncOnPayment === true,
      lastSyncAt: (stored.lastSyncAt as string | null) ?? null,
      lastSyncStatus: (stored.lastSyncStatus as AccountingSettings["lastSyncStatus"]) ?? null,
      lastSyncSummary: (stored.lastSyncSummary as string | null) ?? null,
    } satisfies AccountingSettings;
  }
  return stored; // shipping / tax are returned as stored
}

export async function readGroup(group: SettingGroup): Promise<unknown> {
  return toPublic(group, await readStored(group));
}

export async function readAll(): Promise<Record<SettingGroup, unknown>> {
  const entries = await Promise.all(SETTING_GROUPS.map(async (g) => [g, await readGroup(g)] as const));
  return Object.fromEntries(entries) as Record<SettingGroup, unknown>;
}

/** Merge a partial into a group and persist. Returns the public shape. */
export async function writeGroup(
  group: SettingGroup,
  patch: Record<string, unknown>,
  userId: string | undefined,
): Promise<unknown> {
  const current = await readStored(group);
  const next = { ...current, ...patch };
  await prisma.setting.upsert({
    where: { key: group },
    update: { value: next as Prisma.InputJsonValue, updatedById: userId ?? null },
    create: { key: group, value: next as Prisma.InputJsonValue, updatedById: userId ?? null },
  });
  return toPublic(group, next);
}
