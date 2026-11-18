import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import twilio from "twilio";

const { AccessToken } = twilio.jwt;
const { VoiceGrant } = AccessToken;

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
