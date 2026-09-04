import type { Request, Response } from "express";
import { prisma } from "@tomah/db";
import { HttpError } from "../lib/http-error.js";
import { writeAudit } from "../lib/audit.js";
import { accounting } from "../lib/accounting/index.js";
import { syncInvoiceToAccounting } from "../lib/accounting/sync.js";
import {
  readAll,
  readGroup,
  writeGroup,
  SETTING_GROUPS,
  type SettingGroup,
} from "../lib/settings.js";

/* -------------------------------- read -------------------------------- */

export async function getSettings(_req: Request, res: Response) {
  res.json({ data: await readAll() });
}

export async function getSettingsGroup(req: Request<{ group: string }>, res: Response) {
  const group = req.params.group as SettingGroup;
  if (!SETTING_GROUPS.includes(group)) throw HttpError.notFound("Unknown settings group");
  res.json({ data: await readGroup(group) });
}

/* ------------------------------- write ------------------------------- */

async function saveGroup(group: SettingGroup, patch: Record<string, unknown>, req: Request, res: Response) {
  const data = await writeGroup(group, patch, req.auth?.userId);
  await writeAudit({
    actorId: req.auth?.userId,
    action: `settings.${group}_updated`,
    entityType: "Setting",
    entityId: group,
    summary: `${req.auth?.name} updated ${group} settings`,
    metadata: { fields: Object.keys(patch) },
  });
  res.json({ data });
}

export async function updatePayments(req: Request, res: Response) {
  const b = req.body as { publicKey?: string | null; secretKey?: string; testMode?: boolean };
  const patch: Record<string, unknown> = {};
  if (b.publicKey !== undefined) patch.publicKey = b.publicKey ?? null;
  if (b.testMode !== undefined) patch.testMode = b.testMode;
  // Write-only secret: "" clears it, a value sets it, omitted leaves it be.
  if (b.secretKey !== undefined) patch.secretKey = b.secretKey === "" ? null : b.secretKey;
  await saveGroup("payments", patch, req, res);
}

export async function updateShipping(req: Request, res: Response) {
  const b = req.body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (b.freeShippingThreshold !== undefined) patch.freeShippingThreshold = b.freeShippingThreshold ?? null;
  if (b.defaultFee !== undefined) patch.defaultFee = String(b.defaultFee);
  if (b.rules !== undefined) {
    patch.rules = (b.rules as Array<{ region: string; fee: number | string }>).map((r) => ({
      region: r.region,
      fee: String(r.fee),
    }));
  }
  await saveGroup("shipping", patch, req, res);
}

export async function updateTax(req: Request, res: Response) {
  const b = req.body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (b.defaultRate !== undefined) patch.defaultRate = b.defaultRate;
  if (b.rules !== undefined) patch.rules = b.rules;
  await saveGroup("tax", patch, req, res);
}

export async function updateAccounting(req: Request, res: Response) {
  const b = req.body as { autoSyncOnPayment?: boolean };
  const patch: Record<string, unknown> = {};
  if (b.autoSyncOnPayment !== undefined) patch.autoSyncOnPayment = b.autoSyncOnPayment;
  await saveGroup("accounting", patch, req, res);
}

/* --------------------------- accounting sync ------------------------ */

/**
 * POST /api/v1/accounting/sync — manual trigger. Pushes every PAID invoice that
 * is not already SYNCED through the configured adapter and records the run's
 * result on the "accounting" settings group. A no-op adapter → `ran: false`.
 */
export async function runAccountingSync(req: Request, res: Response) {
  const pending = await prisma.invoice.findMany({
    where: { status: "PAID", accountingSyncStatus: { not: "SYNCED" } },
    select: { id: true },
    take: 500,
  });

  const now = new Date().toISOString();

  if (!accounting.connected) {
    const summary = `No accounting adapter configured (${accounting.name}); ${pending.length} invoice(s) awaiting sync`;
    await writeGroup(
      "accounting",
      { lastSyncAt: now, lastSyncStatus: "failed", lastSyncSummary: summary },
      req.auth?.userId,
    );
    await writeAudit({
      actorId: req.auth?.userId,
      action: "accounting.sync_run",
      entityType: "Setting",
      entityId: "accounting",
      summary: `${req.auth?.name} ran accounting sync — no adapter configured`,
      metadata: { pending: pending.length, adapter: accounting.name },
    });
    return res.json({
      data: { ran: false, adapter: accounting.name, reason: summary, pending: pending.length, synced: 0, failed: 0 },
    });
  }

  const outcomes = [];
  for (const inv of pending) {
    outcomes.push(await syncInvoiceToAccounting(inv.id));
  }
  const synced = outcomes.filter((o) => o.ok).length;
  const failed = outcomes.length - synced;
  const status = failed === 0 ? "success" : synced === 0 ? "failed" : "partial";
  const summary = `${synced} synced, ${failed} failed (adapter: ${accounting.name})`;

  await writeGroup(
    "accounting",
    { lastSyncAt: now, lastSyncStatus: status, lastSyncSummary: summary },
    req.auth?.userId,
  );
  await writeAudit({
    actorId: req.auth?.userId,
    action: "accounting.sync_run",
    entityType: "Setting",
    entityId: "accounting",
    summary: `${req.auth?.name} ran accounting sync — ${summary}`,
    metadata: { synced, failed, adapter: accounting.name },
  });

  res.json({
    data: {
      ran: true,
      adapter: accounting.name,
      synced,
      failed,
      results: outcomes.map((o) => ({ invoiceNumber: o.invoiceNumber, ok: o.ok, error: o.error ?? null })),
    },
  });
}
