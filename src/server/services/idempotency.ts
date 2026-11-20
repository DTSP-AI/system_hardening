import { createHash } from "crypto";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@generated/prisma/client";
import type { PrismaClient } from "@generated/prisma/client";
import type { DbTx } from "@/lib/db";
import { toMachineJson } from "@/lib/json";

/**
 * Runs a write at most once per (principal, tool, key).
 *
 * The key row is inserted first, inside the same transaction as the write. A
 * concurrent duplicate blocks on the unique index until the first commits,
 * then fails and returns the stored result. If the write throws, the
 * transaction rolls back and takes the key row with it, so a failed write can
 * be retried with the same key.
 *
 * A key is bound to the arguments it was first used with: the same key with
 * different arguments is a CONFLICT, never the earlier result. `db` must be
 * the bare client.
 */

type Stored = { requestHash: string; result: Prisma.JsonValue };

/** Stable hash of the arguments: object keys are sorted so key order does not matter. */
export function hashRequest(request: unknown): string {
  const canonical = JSON.stringify(request, (_key, value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)))
      : value,
  );
  return createHash("sha256").update(canonical ?? "null").digest("hex");
}

function replay(stored: Prisma.JsonValue, requestHash: string): Prisma.JsonValue {
  const row = stored as unknown as Stored;
  if (row.requestHash !== requestHash) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This idempotency key was already used with different arguments",
    });
  }
  return row.result;
}

export async function runIdempotent<T>(
  db: PrismaClient,
  id: { principal: string; tool: string; key: string },
  request: unknown,
  fn: (tx: DbTx) => Promise<T>,
): Promise<Prisma.JsonValue> {
  const where = { principal_tool_key: id };
  const requestHash = hashRequest(request);

  const existing = await db.idempotencyKey.findUnique({ where });
  if (existing) return replay(existing.response, requestHash);

  try {
    return await db.$transaction(async (tx) => {
      const row = await tx.idempotencyKey.create({ data: { ...id, response: { requestHash, result: null } } });
      const result = toMachineJson(await fn(tx));
      await tx.idempotencyKey.update({ where: { id: row.id }, data: { response: { requestHash, result } } });
      return result as Prisma.JsonValue;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const winner = await db.idempotencyKey.findUnique({ where });
      if (winner) return replay(winner.response, requestHash);
    }
    throw err;
  }
}
