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
 * be retried with the same key. `db` must be the bare client.
 */
export async function runIdempotent<T>(
  db: PrismaClient,
  id: { principal: string; tool: string; key: string },
  fn: (tx: DbTx) => Promise<T>,
): Promise<Prisma.JsonValue> {
  const where = { principal_tool_key: id };

  const existing = await db.idempotencyKey.findUnique({ where });
  if (existing) return existing.response;

  try {
    return await db.$transaction(async (tx) => {
      const row = await tx.idempotencyKey.create({ data: { ...id, response: {} } });
      const result = toMachineJson(await fn(tx));
      await tx.idempotencyKey.update({ where: { id: row.id }, data: { response: result } });
      return result as Prisma.JsonValue;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const winner = await db.idempotencyKey.findUnique({ where });
      if (winner) return winner.response;
    }
    throw err;
  }
}
