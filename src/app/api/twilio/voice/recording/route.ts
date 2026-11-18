import { mergeCallMetadata } from "@/lib/twilio/activity-merge";
import { ACTIVITY_ID_RE } from "@/lib/twilio/twiml";
import { TwilioConfigError, readValidatedTwilioForm } from "@/lib/twilio/validate";

const RECORDING_SID_RE = /^RE[0-9a-f]{32}$/;

export async function POST(req: Request) {
  let params: Record<string, string> | null;
  try {
    params = await readValidatedTwilioForm(req);
  } catch (err) {
    if (err instanceof TwilioConfigError) {
      console.error("twilio/voice/recording: config error", err);
      return new Response("Server misconfigured", { status: 500 });
    }
    throw err;
  }
  if (!params) {
    return new Response("Invalid signature", { status: 403 });
  }

  // activityId is the canonical id we minted in ../route.ts; never match on a CallSid.
  const activityId = new URL(req.url).searchParams.get("activityId");
  if (!activityId || !ACTIVITY_ID_RE.test(activityId)) {
    console.warn("twilio/voice/recording: missing or malformed activityId");
    return new Response("OK", { status: 200 });
  }

  if (params.RecordingStatus !== "completed") {
    if (params.RecordingStatus === "failed") {
      console.warn("twilio/voice/recording: recording failed", activityId);
    }
    return new Response("OK", { status: 200 });
  }

  const recordingSid = params.RecordingSid;
  if (!recordingSid || !RECORDING_SID_RE.test(recordingSid)) {
    console.warn("twilio/voice/recording: malformed RecordingSid");
    return new Response("OK", { status: 200 });
  }

  try {
    const rows = await mergeCallMetadata(activityId, {
      recordingSid,
      recordingDurationSeconds: Number(params.RecordingDuration) || 0,
    });
    if (rows === 0) {
      console.warn(
        "twilio/voice/recording: no activity matched; recording orphaned at Twilio",
        recordingSid,
      );
    }
  } catch (err) {
    console.error("twilio/voice/recording: db error", err);
    return new Response("Error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
