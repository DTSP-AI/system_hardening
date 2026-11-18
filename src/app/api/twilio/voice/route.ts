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
  statusUrl.searchParams.set("tenantId", identity.tenantId);
  statusUrl.searchParams.set("userId", identity.userId);
  if (params.contactId) statusUrl.searchParams.set("contactId", params.contactId);
  if (params.dealId) statusUrl.searchParams.set("dealId", params.dealId);
  statusUrl.searchParams.set("callSid", parentCallSid);

  const recordingUrl = new URL(`${proto}://${host}/api/twilio/voice/recording`);
  recordingUrl.searchParams.set("tenantId", identity.tenantId);
  recordingUrl.searchParams.set("callSid", parentCallSid);

  const whisperUrl = new URL(`${proto}://${host}/api/twilio/voice/announce`);

  // Heard by the agent's browser leg before the callee is dialed.
  response.say("This call may be recorded for quality and training purposes.");

  // AI coaching relay -- a parallel sibling of <Dial>, not a replacement. Only
  // added when the relay is actually provisioned (Phase 0), so this call flow
  // degrades to the existing dial/record/whisper behavior, unaffected, until
  // then. track: "both_tracks" is required -- Twilio defaults to inbound-only
  // (the callee's audio), which would silently drop the rep's own speech.
  // Custom params ride as <Parameter> children, the only channel Twilio's
  // Media Streams `start` event actually delivers custom data through.
  if (process.env.COACHING_RELAY_WS_URL) {
    // Personalization lookup -- the relay holds no DB credentials by design, so
    // contact/company name must be resolved here and threaded through as plain
    // <Parameter> values. contactId (direct) takes priority; dealId is a
    // fallback path when only a deal, not a contact, was attached to the call.
    let contactName: string | undefined;
    let companyId: string | undefined;

    if (params.contactId) {
      const contact = await prisma.contact.findUnique({
        where: { id: params.contactId },
        select: { firstName: true, lastName: true, companyId: true },
      });
      if (contact) {
        contactName = `${contact.firstName} ${contact.lastName}`.trim();
        companyId = contact.companyId ?? undefined;
      }
    } else if (params.dealId) {
      const deal = await prisma.deal.findUnique({
        where: { id: params.dealId },
        select: { companyId: true, contact: { select: { firstName: true, lastName: true } } },
      });
      if (deal) {
        companyId = deal.companyId ?? undefined;
        if (deal.contact) contactName = `${deal.contact.firstName} ${deal.contact.lastName}`.trim();
      }
    }

    const companyName = companyId
      ? (await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }))?.name
      : undefined;

    const start = response.start();
    const stream = start.stream({
      url: `${process.env.COACHING_RELAY_WS_URL}/twilio-stream`,
      track: "both_tracks",
    });
    stream.parameter({ name: "tenantId", value: identity.tenantId });
    stream.parameter({ name: "userId", value: identity.userId });
    stream.parameter({ name: "callSid", value: parentCallSid });
    if (params.contactId) stream.parameter({ name: "contactId", value: params.contactId });
    if (params.dealId) stream.parameter({ name: "dealId", value: params.dealId });
    if (contactName) stream.parameter({ name: "contactName", value: contactName });
    if (companyName) stream.parameter({ name: "companyName", value: companyName });
    stream.parameter({ name: "secret", value: process.env.COACHING_RELAY_SHARED_SECRET ?? "" });
  }

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
