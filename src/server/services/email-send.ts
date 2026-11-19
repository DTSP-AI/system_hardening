import { TRPCError } from "@trpc/server";
import type { Activity, PrismaClient } from "@generated/prisma/client";
import { EMAIL_LIMITS } from "@/lib/abuse-limits";
import { EmailNotConfiguredError, EmailProviderError, getEmailConfig, sendEmail } from "@/lib/email";
import { consumeRateLimit } from "@/lib/rate-limit";

export type EmailSender = (input: {
  to: string;
  subject: string;
  text: string;
  idempotencyKey?: string;
}) => Promise<{ from: string; resendId?: string }>;

export type EmailSendDeps = { configured: () => boolean; send: EmailSender };

const defaultDeps: EmailSendDeps = { configured: () => getEmailConfig() !== null, send: sendEmail };

/**
 * Sends an email to a contact and records it as an EMAIL activity.
 *
 * The provider call is never made inside a database transaction. The activity
 * is committed first with metadata.status "sending", so a send always has a
 * record; it is then marked "sent", "failed" (the provider refused it) or
 * "unconfirmed" (no answer, so it may have been sent). The provider receives
 * an idempotency key derived from the activity id, so a repeated request for
 * the same activity cannot deliver twice. `db` must be the bare client.
 */
export async function sendContactEmail(
  db: PrismaClient,
  params: { actorId: string; rateKey: string; contactId: string; subject: string; body: string },
  deps: EmailSendDeps = defaultDeps,
): Promise<Activity> {
  // Config first so a misconfigured app never uses up quota.
  if (!deps.configured()) {
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Email isn't configured" });
  }

  const contact = await db.contact.findUnique({ where: { id: params.contactId } });
  if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });
  if (!contact.email) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "This contact has no email address on file" });
  }

  let decision;
  try {
    decision = await consumeRateLimit("email:send:" + params.rateKey, EMAIL_LIMITS);
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

  const base = { direction: "outbound", to: contact.email, subject: params.subject };
  const pending = await db.activity.create({
    data: {
      type: "EMAIL",
      contactId: params.contactId,
      authorId: params.actorId,
      body: params.body,
      metadata: { ...base, status: "sending" },
    },
  });

  /** Best effort: a failed status write must never hide the send's real outcome. */
  const record = async (metadata: Record<string, string | undefined>): Promise<Activity | null> => {
    try {
      return await db.activity.update({ where: { id: pending.id }, data: { metadata } });
    } catch (err) {
      console.error("email.send: could not record status for activity", pending.id, err);
      return null;
    }
  };

  let sent;
  try {
    sent = await deps.send({
      to: contact.email,
      subject: params.subject,
      text: params.body,
      idempotencyKey: `email-activity/${pending.id}`,
    });
  } catch (err) {
    if (err instanceof EmailNotConfiguredError) {
      await record({ ...base, status: "failed" });
      throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Email isn't configured" });
    }
    if (err instanceof EmailProviderError && err.outcome === "rejected") {
      await record({ ...base, status: "failed" });
      console.error("email.send: provider rejected the message", err.cause);
      throw new TRPCError({ code: "BAD_GATEWAY", message: "Email provider rejected the message" });
    }
    // Network error, timeout or anything else: the message may have been sent.
    await record({ ...base, status: "unconfirmed" });
    console.error("email.send: outcome unknown", err);
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "Email delivery could not be confirmed. Check with the contact before sending it again.",
    });
  }

  const sentMetadata = { ...base, status: "sent", from: sent.from, resendId: sent.resendId };
  // The provider accepted the message. If recording that fails, still report success:
  // an error here would invite a resend, and the contact would get the email twice.
  return (await record(sentMetadata)) ?? { ...pending, metadata: sentMetadata };
}
