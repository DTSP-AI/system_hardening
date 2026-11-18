import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "@/server/api/trpc";
import { signCoachingToken } from "@/lib/coaching-token";

export const coachingRouter = createTRPCRouter({
  /** Creates the session row and mints the short-lived relay handshake token -- called
   * the instant the rep opens the AI Coach popup, before any relay traffic can arrive. */
  startSession: tenantProcedure
    .input(
      z.object({
        callSid: z.string(),
        contactId: z.string().optional(),
        dealId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.callCoachingSession.create({
        data: {
          tenantId: ctx.tenantId,
          callSid: input.callSid,
          userId: ctx.userId,
          contactId: input.contactId,
          dealId: input.dealId,
        },
      });

      const payload = {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        callSid: input.callSid,
        exp: Date.now() + 5 * 60_000,
      };

      return {
        token: signCoachingToken(payload),
        relayWsUrl: process.env.COACHING_RELAY_WS_URL!,
      };
    }),

  byCallSid: tenantProcedure
    .input(z.object({ callSid: z.string() }))
    .query(({ ctx, input }) =>
      ctx.db.callCoachingSession.findFirst({ where: { callSid: input.callSid } }),
    ),
});
