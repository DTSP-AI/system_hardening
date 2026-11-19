import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
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
 * Requires a signed-in Clerk user that resolves to an allowlisted, active
 * app User (see resolveAppUser). Resolution runs outside the transaction on
 * the bare client; the rest of the request then runs inside one Prisma
 * interactive transaction, exposed as `ctx.db`. Procedures must use `ctx.db`,
 * never the bare `ctx.prisma`. `ctx.userId` stays the Clerk user id;
 * `ctx.user` is the app User row.
 */
export const authedProcedure = protectedProcedure.use(async ({ ctx, next, type }) => {
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
  return ctx.prisma.$transaction((tx) => next({ ctx: { ...ctx, user, db: tx } }));
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
