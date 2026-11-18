import { createTRPCRouter, tenantProcedure } from "@/server/api/trpc";

export const membershipRouter = createTRPCRouter({
  me: tenantProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({ where: { clerkUserId: ctx.userId } });
    return { role: user?.role ?? "MEMBER" } as const;
  }),
});
