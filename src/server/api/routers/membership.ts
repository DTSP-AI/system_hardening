import { createTRPCRouter, authedProcedure } from "@/server/api/trpc";

export const membershipRouter = createTRPCRouter({
  me: authedProcedure.query(({ ctx }) => ({ role: ctx.user.role })),
});
