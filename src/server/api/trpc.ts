import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import type { DbTx } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { resolveAppUser } from "@/lib/auth/app-user";

export async function createTRPCContext() {
  const { userId } = await auth();
  return { userId, prisma };
}

type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

/** Requires a signed-in Clerk user. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

/** Per-user cap on writes: generous for humans, bounds a stolen session or runaway client. */
const MUTATION_LIMITS = [
  { windowMs: 60_000, max: 120 },
  { windowMs: 60 * 60_000, max: 1500 },
] as const;

/**
 * Requires a signed-in Clerk user that resolves to an allowlisted, active app
 * User (see resolveAppUser), and applies the per-user write limit. Opens no
 * transaction: `ctx.db` and `ctx.prisma` are both the bare client.
 *
 * Use this directly only for a mutation that calls an external service
 * (email, storage). Such a procedure must not hold a transaction across that
 * call; it opens a short one itself around its own writes. Everything else
 * uses authedProcedure. `ctx.userId` stays the Clerk user id; `ctx.user` is
 * the app User row.
 */
export const authedProcedureNoTx = protectedProcedure.use(async ({ ctx, next, type }) => {
  const resolved = await resolveAppUser(ctx.userId);
  if (resolved.status === "unavailable") {
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Account verification unavailable",
    });
  }
  if (resolved.status !== "ok") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Account not authorized" });
  }
  const user = resolved.user;
  if (type === "mutation") {
    let decision;
    try {
      decision = await consumeRateLimit("trpc:mutation:" + user.id, MUTATION_LIMITS);
    } catch {
      throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Rate limiter unavailable" });
    }
    if (!decision.allowed) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Too many changes. Try again in ${decision.retryAfterSeconds}s.`,
      });
    }
  }
  const db: DbTx = ctx.prisma;
  return next({ ctx: { ...ctx, user, db } });
});

/**
 * The standard gated procedure. A query reads through the bare client and
 * opens no transaction. A mutation runs inside one Prisma interactive
 * transaction, exposed as `ctx.db`, so its writes and audit rows commit or
 * roll back together. Procedures use `ctx.db`, never the bare `ctx.prisma`.
 */
export const authedProcedure = authedProcedureNoTx.use(({ ctx, next, type }) => {
  if (type !== "mutation") return next({ ctx });
  return ctx.prisma.$transaction(async (tx) => {
    const result = await next({ ctx: { ...ctx, db: tx as DbTx } });
    // tRPC returns a failed procedure as a result object instead of throwing.
    // Rethrow it here, or the transaction would commit the partial writes.
    if (!result.ok) throw result.error;
    return result;
  });
});

/** authedProcedure, plus requires an OWNER or ADMIN role. No extra DB call. */
export const adminProcedure = authedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "OWNER" && ctx.user.role !== "ADMIN") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You don't have permission to do this.",
    });
  }
  return next({ ctx });
});
