import { prisma, type Prisma } from "@tomah/db";

/**
 * Append a row to `audit_logs`. Fire-and-forget friendly, but await it inside
 * the same request so a failure surfaces in development.
 */
export async function writeAudit(entry: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  summary?: string;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      summary: entry.summary,
      metadata: entry.metadata,
    },
  });
}
