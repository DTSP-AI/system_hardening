import twilio from "twilio";
import { CALL_TIME_LIMIT_SECONDS } from "@/lib/abuse-limits";

export const ACTIVITY_ID_RE = /^[a-z0-9]{20,40}$/;

export function sayAndHangup(message: string): string {
  const response = new twilio.twiml.VoiceResponse();
  response.say(message);
  response.hangup();
  return response.toString();
}

/**
 * Callback URLs carry exactly one query key, a non-empty activityId we minted
 * (Law 2: no empty-valued params on signed URLs; Law 3: canonical id, never a CallSid).
 */
function callbackUrl(origin: string, path: string, activityId: string): string {
  const url = new URL(origin + path);
  url.searchParams.set("activityId", activityId);
  return url.toString();
}

export function buildOutboundDialTwiml(opts: {
  origin: string;
  activityId: string;
  to: string;
  callerId: string;
}): string {
  const { origin, activityId, to, callerId } = opts;
  if (!ACTIVITY_ID_RE.test(activityId)) {
    throw new Error("buildOutboundDialTwiml: invalid activityId");
  }

  const statusCallback = callbackUrl(origin, "/api/twilio/voice/status", activityId);
  const recordingStatusCallback = callbackUrl(origin, "/api/twilio/voice/recording", activityId);
  const announceUrl = new URL(origin + "/api/twilio/voice/announce").toString();

  const response = new twilio.twiml.VoiceResponse();
  // Heard by the agent's browser leg before the callee is dialed.
  response.say("This call may be recorded for quality and training purposes.");

  const dial = response.dial({
    callerId,
    timeLimit: CALL_TIME_LIMIT_SECONDS,
    record: "record-from-answer",
    recordingStatusCallback,
    recordingStatusCallbackMethod: "POST",
    recordingStatusCallbackEvent: ["completed"],
  });
  dial.number(
    {
      statusCallback,
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["completed"],
      // Whisper URL: played to the callee alone once they answer.
      url: announceUrl,
      method: "POST",
    },
    to,
  );

  return response.toString();
}
