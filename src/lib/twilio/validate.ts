import twilio from "twilio";

/** Thrown when required Twilio configuration (e.g. the auth token) is missing. */
export class TwilioConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TwilioConfigError";
  }
}

/**
 * The origin (proto + host) Twilio addresses us at. Single source for both the
 * URL we validate signatures against and the callback URLs we hand to Twilio.
 */
export function getRequestOrigin(req: Request): string {
  const requestUrl = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "");
  const host = req.headers.get("host") ?? requestUrl.host;
  return `${proto}://${host}`;
}

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
    throw new TwilioConfigError("TWILIO_AUTH_TOKEN is not configured");
  }

  const rawBody = await req.text();
  const params = Object.fromEntries(new URLSearchParams(rawBody));

  const signature = req.headers.get("x-twilio-signature") ?? "";
  const requestUrl = new URL(req.url);
  const url = `${getRequestOrigin(req)}${requestUrl.pathname}${requestUrl.search}`;

  const isValid = twilio.validateRequest(authToken, signature, url, params);
  return isValid ? params : null;
}

/** A Voice SDK identity is the bare Clerk userId. */
export function parseCallIdentity(identity: string): { userId: string } | null {
  if (!identity) return null;
  return { userId: identity };
}
