import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";

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

/**
 * Bridge procedure (single-tenant). The name is kept so existing routers keep
 * working; there is no tenant or org resolution any more. Requires a signed-in
 * user and runs the rest of the request inside one Prisma interactive
 * transaction, exposed as `ctx.db`. Procedures must use `ctx.db`, never the
 * bare `ctx.prisma`. Phase 5 replaces this with authedProcedure/adminProcedure
 * and links Users to Clerk sign-ins.
 */
export const tenantProcedure = protectedProcedure.use(({ ctx, next }) =>
  ctx.prisma.$transaction((tx) => next({ ctx: { ...ctx, db: tx } })),
);

/**
 * Bridge: same as tenantProcedure, plus requires an ADMIN or OWNER User role.
 * Fails closed (FORBIDDEN) while no User row is linked to the Clerk user.
 * Phase 5 replaces this with the final adminProcedure.
 */
export const adminProcedure = tenantProcedure.use(async ({ ctx, next }) => {
  await requireRole(ctx.db, ctx.userId, ["OWNER", "ADMIN"]);
  return next({ ctx });
});
