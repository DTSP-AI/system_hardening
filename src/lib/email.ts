import { Resend } from "resend";

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("Email sending isn't configured (missing RESEND_API_KEY or EMAIL_FROM_ADDRESS)");
    this.name = "EmailNotConfiguredError";
  }
}

/** The provider's message lives in `cause` and is logged, never shown to the user. */
export class EmailProviderError extends Error {
  constructor(cause: unknown) {
    super("Email provider rejected the message", { cause });
    this.name = "EmailProviderError";
  }
}

export function getEmailConfig(): { apiKey: string; from: string } | null {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM_ADDRESS;
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

export async function sendEmail(input: { to: string; subject: string; text: string }) {
  const config = getEmailConfig();
  if (!config) throw new EmailNotConfiguredError();

  const resend = new Resend(config.apiKey);
  let result;
  try {
    result = await resend.emails.send({
      from: config.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
  } catch (err) {
    throw new EmailProviderError(err);
  }
  if (result.error) {
    throw new EmailProviderError(result.error);
  }
  return { from: config.from, resendId: result.data?.id };
}
