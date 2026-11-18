import twilio from "twilio";

/**
 * Reads a Twilio webhook's raw form body and validates X-Twilio-Signature
 * against it. Must run before any other body parsing -- the signature is
 * computed over the exact raw bytes Twilio sent.
 */
export async function readValidatedTwilioForm(
  req: Request,
): Promise<Record<string, string> | null> {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    throw new Error("TWILIO_AUTH_TOKEN is not configured");
  }

  const rawBody = await req.text();
  const params = Object.fromEntries(new URLSearchParams(rawBody));

  const signature = req.headers.get("x-twilio-signature") ?? "";
  const requestUrl = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "");
  const host = req.headers.get("host") ?? requestUrl.host;
  const url = `${proto}://${host}${requestUrl.pathname}${requestUrl.search}`;

  const isValid = twilio.validateRequest(authToken, signature, url, params);
  return isValid ? params : null;
}

/** A Voice SDK identity is the bare Clerk userId. */
export function parseCallIdentity(identity: string): { userId: string } | null {
  if (!identity) return null;
  return { userId: identity };
}
