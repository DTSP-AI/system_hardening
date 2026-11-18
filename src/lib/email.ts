import { Resend } from "resend";

export async function sendEmail(input: { to: string; subject: string; text: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM_ADDRESS;
  if (!apiKey || !from) {
    throw new Error("Email sending isn't configured (missing RESEND_API_KEY or EMAIL_FROM_ADDRESS)");
  }

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });
  if (result.error) {
    throw new Error(result.error.message);
  }
  return { from, resendId: result.data?.id };
}
