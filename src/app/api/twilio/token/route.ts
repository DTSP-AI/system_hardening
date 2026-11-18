import { NextResponse } from "next/server";
import twilio from "twilio";
import { requireAppUserForRoute } from "@/lib/auth/app-user";

const { AccessToken } = twilio.jwt;
const { VoiceGrant } = AccessToken;

export async function POST() {
  const guard = await requireAppUserForRoute();
  if (guard instanceof Response) return guard;
  const userId = guard.user.clerkUserId;
  if (!userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_TWIML_APP_SID } =
    process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY_SID || !TWILIO_API_KEY_SECRET || !TWILIO_TWIML_APP_SID) {
    return NextResponse.json({ error: "Calling is not configured" }, { status: 503 });
  }

  const identity = userId;

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: TWILIO_TWIML_APP_SID,
    incomingAllow: false,
  });

  const token = new AccessToken(TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, {
    identity,
    ttl: 3600,
  });
  token.addGrant(voiceGrant);

  return NextResponse.json({ token: token.toJwt(), identity });
}
