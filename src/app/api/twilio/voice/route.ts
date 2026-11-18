import twilio from "twilio";
import { prisma } from "@/lib/db";
import { readValidatedTwilioForm, parseCallIdentity } from "@/lib/twilio/validate";

export async function POST(req: Request) {
  const params = await readValidatedTwilioForm(req);
  if (!params) {
    return new Response("Invalid signature", { status: 403 });
  }

  const response = new twilio.twiml.VoiceResponse();

  // From is "client:<identity>" for calls placed by the softphone dock --
  // Twilio has already authenticated this identity via the Access Token used
  // to establish the connection, so it's trustworthy in a way the client-
  // supplied params below (contactId/dealId) are not.
  const rawFrom = params.From ?? "";
  const identity = parseCallIdentity(rawFrom.replace(/^client:/, ""));
  const to = params.To;

  if (!identity || !to) {
    response.say("This call is missing required routing information.");
    return new Response(response.toString(), {
      headers: { "Content-Type": "text/xml" },
    });
  }

  // Allowlist check: the identity is a Clerk user id; it must map to an
  // active app User, otherwise no outbound call is placed.
  const caller = await prisma.user.findUnique({ where: { clerkUserId: identity.userId } });
  if (!caller || caller.deactivatedAt) {
    response.say("This caller is not authorized.");
    response.hangup();
    return new Response(response.toString(), {
      headers: { "Content-Type": "text/xml" },
    });
  }

  const requestUrl = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "");
  const host = req.headers.get("host") ?? requestUrl.host;

  // Twilio reports a DIFFERENT CallSid to each downstream webhook: the
  // Number-level statusCallback below fires with the CHILD leg's CallSid,
  // while the Dial-level recordingStatusCallback fires with the PARENT
  // leg's CallSid (this top-level request's own params.CallSid). Those two
  // webhooks can never agree on a CallSid by trusting their own params, so
  // we mint one canonical id here -- the parent CallSid -- and thread it
  // through both URLs as an explicit query param that both sides read
  // instead of (or in preference to) their own reported CallSid.
  const parentCallSid = params.CallSid ?? "";

  const statusUrl = new URL(`${proto}://${host}/api/twilio/voice/status`);
  statusUrl.searchParams.set("userId", identity.userId);
  if (params.contactId) statusUrl.searchParams.set("contactId", params.contactId);
  if (params.dealId) statusUrl.searchParams.set("dealId", params.dealId);
  statusUrl.searchParams.set("callSid", parentCallSid);

  const recordingUrl = new URL(`${proto}://${host}/api/twilio/voice/recording`);
  recordingUrl.searchParams.set("callSid", parentCallSid);

  const whisperUrl = new URL(`${proto}://${host}/api/twilio/voice/announce`);

  // Heard by the agent's browser leg before the callee is dialed.
  response.say("This call may be recorded for quality and training purposes.");

  const dial = response.dial({
    callerId: process.env.TWILIO_CALLER_ID || undefined,
    record: "record-from-answer",
    recordingStatusCallback: recordingUrl.toString(),
    recordingStatusCallbackMethod: "POST",
    recordingStatusCallbackEvent: ["completed"],
  });
  dial.number(
    {
      statusCallback: statusUrl.toString(),
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["completed"],
      // "Whisper" URL: Twilio requests this once the callee answers and plays
      // its TwiML to that leg alone, before auto-joining it to the bridge --
      // this is what actually informs the *called* party, since a <Say> at
      // the top of this response only plays on the agent's leg.
      url: whisperUrl.toString(),
      method: "POST",
    },
    to,
  );

  return new Response(response.toString(), {
    headers: { "Content-Type": "text/xml" },
  });
}
