import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, authedProcedure } from "@/server/api/trpc";
import { sendEmail } from "@/lib/email";

export const emailRouter = createTRPCRouter({
  send: authedProcedure
    .input(z.object({ contactId: z.string(), subject: z.string().min(1), body: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const contact = await ctx.db.contact.findUniqueOrThrow({ where: { id: input.contactId } });
      if (!contact.email) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This contact has no email address on file" });
      }

      const { from, resendId } = await sendEmail({ to: contact.email, subject: input.subject, text: input.body });

      return ctx.db.activity.create({
        data: {
          type: "EMAIL",
          contactId: input.contactId,
          authorId: ctx.userId,
          body: input.body,
          metadata: { direction: "outbound", to: contact.email, from, subject: input.subject, resendId },
        },
      });
    }),
});
