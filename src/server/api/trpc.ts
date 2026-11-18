import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma, scopedDb } from "@/lib/db";
import { ensureTenant, ensureMembership } from "@/lib/tenant";
import { requireRole } from "@/lib/rbac";

export async function createTRPCContext() {
  const { userId, orgId } = await auth();
  return { userId, orgId, prisma };
}

type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

/** Requires a signed-in Clerk user; no tenant/org resolution yet. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

/**
 * Requires a signed-in user with an active Clerk Organization that maps to a
 * local Tenant. Runs the entire rest of the request inside one Prisma
 * interactive transaction opened on the tenant-scoped client (see
 * src/lib/db.ts -- extension has to be applied *before* the transaction
 * starts, since Prisma disallows `$extends` inside one). Inside the
 * transaction, `set_config('app.current_tenant_id', ...)` sets layer 2
 * (Postgres RLS, see prisma/rls.sql), while every query automatically carries
 * layer 1 (tenantId auto-injection) via the inherited extension. Procedures
 * must use `ctx.db`, never the bare `ctx.prisma`, to get either guarantee.
 */
export const tenantProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.orgId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No active organization selected",
    });
  }

  let tenant = await ctx.prisma.tenant.findUnique({
    where: { clerkOrgId: ctx.orgId },
  });

  // Normally provisioned by the organization.created webhook, but that's async
  // and can race a user who creates an org and immediately starts using the
  // app (or never had the webhook delivered in this environment) -- fall back
  // to provisioning on demand from Clerk's own org record.
  if (!tenant) {
    const client = await clerkClient();
    const org = await client.organizations.getOrganization({ organizationId: ctx.orgId });
    tenant = await ensureTenant({ clerkOrgId: org.id, name: org.name, slug: org.slug });
  }

  const scoped = scopedDb(tenant.id);

  return scoped.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenant.id}, true)`;
    return next({
      ctx: {
        ...ctx,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        db: tx,
      },
    });
  });
});

/** Same guarantees as tenantProcedure, plus requires an ADMIN or OWNER Membership role. */
export const adminProcedure = tenantProcedure.use(async ({ ctx, next }) => {
  await requireRole(
    ctx.db,
    { tenantId: ctx.tenantId, clerkOrgId: ctx.orgId!, clerkUserId: ctx.userId },
    ["OWNER", "ADMIN"],
  );
  return next({ ctx });
});
