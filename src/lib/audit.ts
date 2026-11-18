import type { Prisma } from "@generated/prisma/client";
import type { ScopedTx } from "@/lib/db";

/** Normalizes a Prisma record (Decimal/Date fields) into plain JSON for the `diff` column. */
export function toJsonSafe(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value));
}

/** Writes an AuditLog row inline from within a tenantProcedure's `ctx.db`. */
export function logAudit(
  db: ScopedTx,
  tenantId: string,
  params: {
    actorId: string;
    entityType: string;
    entityId: string;
    action: "CREATE" | "UPDATE" | "DELETE";
    diff?: Prisma.InputJsonValue;
  },
) {
  return db.auditLog.create({ data: { ...params, tenantId } });
}
