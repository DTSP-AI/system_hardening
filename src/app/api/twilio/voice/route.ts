import { prisma } from "@/lib/db";
import { CALL_DAILY } from "@/lib/abuse-limits";
import { consumeRateLimit } from "@/lib/rate-limit";
import { checkDialable } from "@/lib/twilio/dial-policy";
import { buildOutboundDialTwiml, sayAndHangup } from "@/lib/twilio/twiml";
import {
  TwilioConfigError,
  getRequestOrigin,
  parseCallIdentity,
  readValidatedTwilioForm,
} from "@/lib/twilio/validate";

// Every TwiML response is HTTP 200 text/xml; the only non-200 is a bad signature.
function twiml(xml: string): Response {
  return new Response(xml, { headers: { "Content-Type": "text/xml" } });
}

const UNAVAILABLE = "Calling is temporarily unavailable. Please try again later.";

/** A client-supplied id: empty means absent; must be 1-64 chars; must exist. */
async function resolveOptionalId(
  raw: string | undefined,
  label: "contactId" | "dealId",
): Promise<string | null> {
  if (!raw) return null;
  if (raw.length > 64) {
    console.warn(`twilio/voice: ${label} too long, ignoring`);
    return null;
  }
  const found =
    label === "contactId"
      ? await prisma.contact.findUnique({ where: { id: raw }, select: { id: true } })
      : await prisma.deal.findUnique({ where: { id: raw }, select: { id: true } });
  if (!found) {
    console.warn(`twilio/voice: ${label} not found, ignoring`);
    return null;
  }
  return found.id;
}

export async function POST(req: Request) {
  let params: Record<string, string> | null;
  try {
    params = await readValidatedTwilioForm(req);
  } catch (err) {
    if (err instanceof TwilioConfigError) {
      console.error("twilio/voice: config error", err);
      return twiml(sayAndHangup(UNAVAILABLE));
    }
    throw err;
  }
  if (!params) {
    return new Response("Invalid signature", { status: 403 });
  }

  // From is "client:<identity>" for calls placed by the softphone dock --
  // Twilio has already authenticated this identity via the Access Token.
  const rawFrom = params.From ?? "";
  const identity = rawFrom.startsWith("client:")
    ? parseCallIdentity(rawFrom.slice("client:".length))
    : null;
  const rawTo = params.To;
  if (!identity || !rawTo) {
    return twiml(sayAndHangup("This call is missing required routing information."));
  }

  // Before any DB work so bad numbers never use up the cap.
  const dial = checkDialable(rawTo);
  if (!dial.ok) {
    console.warn(`twilio/voice: number rejected (${dial.reason})`);
    return twiml(sayAndHangup("This number cannot be dialed."));
  }

  const callerId = process.env.TWILIO_CALLER_ID;
  if (!callerId) {
    console.error("twilio/voice: TWILIO_CALLER_ID is not set");
    return twiml(sayAndHangup("Calling is not configured."));
  }

  try {
    const user = await prisma.user.findUnique({ where: { clerkUserId: identity.userId } });
    if (!user || user.deactivatedAt) {
      return twiml(sayAndHangup("This caller is not authorized."));
    }

    const contactId = await resolveOptionalId(params.contactId, "contactId");
    const dealId = await resolveOptionalId(params.dealId, "dealId");

    const decision = await consumeRateLimit("call:start:" + user.id, CALL_DAILY);
    if (!decision.allowed) {
      return twiml(sayAndHangup("You have reached the daily call limit."));
    }

    // parentCallSid is informational only; correlation uses this Activity's id.
    const activity = await prisma.activity.create({
      data: {
        type: "CALL",
        authorId: identity.userId,
        contactId,
        dealId,
        body: "Call to " + dial.e164,
        metadata: {
          status: "initiated",
          to: dial.e164,
          from: callerId,
          direction: "outbound",
          parentCallSid: params.CallSid ?? "",
        },
      },
      select: { id: true },
    });

    return twiml(
      buildOutboundDialTwiml({
        origin: getRequestOrigin(req),
        activityId: activity.id,
        to: dial.e164,
        callerId,
      }),
    );
  } catch (err) {
    console.error("twilio/voice: failed", err);
    return twiml(sayAndHangup(UNAVAILABLE));
  }
}
