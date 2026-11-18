import type { Prisma } from "@generated/prisma/client";
import type { DbTx } from "@/lib/db";

/** Normalizes a Prisma record (Decimal/Date fields) into plain JSON for the `diff` column. */
export function toJsonSafe(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value));
}

/** Writes an AuditLog row inline from within a procedure's `ctx.db`. */
export function logAudit(
  db: DbTx,
  params: {
    actorId: string;
    entityType: string;
    entityId: string;
    action: "CREATE" | "UPDATE" | "DELETE";
    diff?: Prisma.InputJsonValue;
  },
) {
  return db.auditLog.create({ data: params });
}
