import { z } from "zod";
import { zId } from "@/lib/validation";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, authedProcedure } from "@/server/api/trpc";
import { EmailNotConfiguredError, EmailProviderError, getEmailConfig, sendEmail } from "@/lib/email";
import { EMAIL_LIMITS } from "@/lib/abuse-limits";
import { consumeRateLimit } from "@/lib/rate-limit";

export const emailRouter = createTRPCRouter({
  send: authedProcedure
    .input(
      z.object({
        contactId: zId,
        subject: z.string().min(1).max(200).regex(/^[^\r\n]*$/),
        body: z.string().min(1).max(10_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Config first so a misconfigured app never uses up quota.
      if (!getEmailConfig()) {
        throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Email isn't configured" });
      }

      const contact = await ctx.db.contact.findUniqueOrThrow({ where: { id: input.contactId } });
      if (!contact.email) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This contact has no email address on file" });
      }

      let decision;
      try {
        decision = await consumeRateLimit("email:send:" + ctx.user.id, EMAIL_LIMITS);
      } catch (err) {
        console.error("email.send: rate limiter failed", err);
        throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Email is temporarily unavailable" });
      }
      if (!decision.allowed) {
        const minutes = Math.max(1, Math.ceil(decision.retryAfterSeconds / 60));
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Email limit reached, try again in ${minutes} minute${minutes === 1 ? "" : "s"}`,
        });
      }

      let sent;
      try {
        sent = await sendEmail({ to: contact.email, subject: input.subject, text: input.body });
      } catch (err) {
        if (err instanceof EmailNotConfiguredError) {
          throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Email isn't configured" });
        }
        if (err instanceof EmailProviderError) {
          console.error("email.send: provider error", err.cause);
          throw new TRPCError({ code: "BAD_GATEWAY", message: "Email provider rejected the message" });
        }
        throw err;
      }

      return ctx.db.activity.create({
        data: {
          type: "EMAIL",
          contactId: input.contactId,
          authorId: ctx.userId,
          body: input.body,
          metadata: { direction: "outbound", to: contact.email, from: sent.from, subject: input.subject, resendId: sent.resendId },
        },
      });
    }),
});
