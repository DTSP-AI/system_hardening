import { createTRPCRouter, tenantProcedure } from "@/server/api/trpc";
import { ensureMembership } from "@/lib/tenant";

export const membershipRouter = createTRPCRouter({
  me: tenantProcedure.query(async ({ ctx }) => {
    let membership = await ctx.db.membership.findFirst({
      where: { clerkUserId: ctx.userId },
    });
    if (!membership) {
      membership = await ensureMembership({
        tenantId: ctx.tenantId,
        clerkOrgId: ctx.orgId!,
        clerkUserId: ctx.userId,
      });
    }
    return { role: membership.role } as const;
  }),
});
