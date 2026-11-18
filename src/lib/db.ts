import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient } from "@generated/prisma/client";

neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Returns a Prisma client scoped to a single tenant: every query issued
 * through it has `tenantId` auto-injected into `where` (reads/updates/deletes)
 * and `data` (creates), so callers can never accidentally cross tenant
 * boundaries by forgetting a filter.
 *
 * This is layer 1 of tenant isolation. Layer 2 is Postgres RLS (prisma/rls.sql),
 * enforced via `set_config('app.current_tenant_id', ...)`. Both layers must be
 * applied to the SAME transaction, so `tenantProcedure` (src/server/api/trpc.ts)
 * calls this *before* opening `$transaction` -- the extension is inherited by
 * the interactive transaction's `tx` client automatically; `$extends` itself
 * cannot be called again from inside a transaction (Prisma denies it there).
 */
export function scopedDb(tenantId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({
          args,
          query,
          operation,
          model,
        }: {
          args: Record<string, unknown>;
          query: (args: unknown) => Promise<unknown>;
          operation: string;
          model?: string;
        }) {
          if (model === "Tenant") return query(args);

          if (
            operation.startsWith("find") ||
            operation.startsWith("update") ||
            operation.startsWith("delete") ||
            operation === "count" ||
            operation === "aggregate" ||
            operation === "groupBy"
          ) {
            args.where = { ...(args.where as object | undefined), tenantId };
          }
          if (operation === "create") {
            args.data = { ...(args.data as object), tenantId };
          }
          if (operation === "createMany") {
            const data = args.data as Record<string, unknown>[] | Record<string, unknown>;
            args.data = Array.isArray(data)
              ? data.map((d) => ({ ...d, tenantId }))
              : { ...data, tenantId };
          }
          return query(args);
        },
      },
    },
  });
}

export type ScopedDb = ReturnType<typeof scopedDb>;

/** The `tx` client tRPC's `tenantProcedure` hands out as `ctx.db` (see trpc.ts). */
export type ScopedTx = Parameters<Parameters<ScopedDb["$transaction"]>[0]>[0];
