import { Resend } from "resend";

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("Email sending isn't configured (missing RESEND_API_KEY or EMAIL_FROM_ADDRESS)");
    this.name = "EmailNotConfiguredError";
  }
}

/** The provider's message lives in `cause` and is logged, never shown to the user. */
/**
 * `outcome` says what is known about delivery. "rejected": the provider
 * answered and refused the message, so it was not sent. "unknown": the request
 * failed or timed out before an answer, so the message may have been sent.
 */
export type EmailOutcome = "rejected" | "unknown";

export class EmailProviderError extends Error {
  readonly outcome: EmailOutcome;
  constructor(cause: unknown, outcome: EmailOutcome = "unknown") {
    super(
      outcome === "rejected" ? "Email provider rejected the message" : "Email delivery could not be confirmed",
      { cause },
    );
    this.name = "EmailProviderError";
    this.outcome = outcome;
  }
}

/**
 * Error names the Resend SDK returns when it never got a usable answer: a
 * failed fetch, an unparseable reply, or a provider-side failure. Observed in
 * resend 4.8.0 (fetchRequest returns these instead of throwing). The message
 * may have been accepted, so none of them is a rejection.
 */
const NO_ANSWER_ERROR_NAMES: ReadonlySet<string> = new Set(["application_error", "internal_server_error"]);

/**
 * What an error object returned by the provider SDK says about delivery. Only
 * a named error outside the no-answer set is a rejection; anything
 * unrecognised is "unknown", because calling a sent email "not sent" invites a
 * duplicate.
 */
export function outcomeOfProviderError(error: unknown): EmailOutcome {
  const name =
    error && typeof error === "object" && "name" in error ? (error as { name?: unknown }).name : undefined;
  if (typeof name !== "string" || name.length === 0) return "unknown";
  return NO_ANSWER_ERROR_NAMES.has(name) ? "unknown" : "rejected";
}

/** How long to wait for the provider before treating the outcome as unknown. */
export const EMAIL_SEND_TIMEOUT_MS = 20_000;

export function getEmailConfig(): { apiKey: string; from: string } | null {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM_ADDRESS;
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  /** Sent as the Idempotency-Key header so a repeated request cannot deliver twice. */
  idempotencyKey?: string;
}) {
  const config = getEmailConfig();
  if (!config) throw new EmailNotConfiguredError();

  const resend = new Resend(config.apiKey);
  let result;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error("email provider timed out")), EMAIL_SEND_TIMEOUT_MS);
    });
    result = await Promise.race([
      timeout,
      resend.emails.send(
        {
          from: config.from,
          to: input.to,
          subject: input.subject,
          text: input.text,
        },
        input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
      ),
    ]);
  } catch (err) {
    throw new EmailProviderError(err, "unknown");
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (result.error) {
    throw new EmailProviderError(result.error, outcomeOfProviderError(result.error));
  }
  return { from: config.from, resendId: result.data?.id };
}
