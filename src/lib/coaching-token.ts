import { createHmac } from "node:crypto";

/**
 * Short-lived, single-purpose credential handed to the AI Coach popup so it
 * can authenticate its WebSocket handshake with the standalone coaching relay
 * service without either side needing a JWT library -- a plain HMAC over a
 * JSON payload is enough since the relay holds the same shared secret and
 * only ever needs to check the signature + exp + that the callSid matches.
 */
export function signCoachingToken(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", process.env.COACHING_RELAY_SHARED_SECRET!)
    .update(body)
    .digest("hex");
  return `${body}.${sig}`;
}
