import { z } from "zod";
import { zId } from "@/lib/validation";
import { createTRPCRouter, authedProcedureNoTx } from "@/server/api/trpc";
import { sendContactEmail } from "@/server/services/email-send";

export const emailRouter = createTRPCRouter({
  // No transaction: the provider call must not run inside one (see services/email-send.ts).
  send: authedProcedureNoTx
    .input(
      z.object({
        contactId: zId,
        subject: z.string().min(1).max(200).regex(/^[^\r\n]*$/),
        body: z.string().min(1).max(10_000),
      }),
    )
    .mutation(({ ctx, input }) =>
      sendContactEmail(ctx.prisma, {
        actorId: ctx.userId,
        rateKey: ctx.user.id,
        contactId: input.contactId,
        subject: input.subject,
        body: input.body,
      }),
    ),
});
