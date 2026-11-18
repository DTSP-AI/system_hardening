import { mergeCallMetadata } from "@/lib/twilio/activity-merge";
import { ACTIVITY_ID_RE } from "@/lib/twilio/twiml";
import { TwilioConfigError, readValidatedTwilioForm } from "@/lib/twilio/validate";

const FINAL_STATUSES = new Set(["completed", "busy", "no-answer", "failed", "canceled"]);

export async function POST(req: Request) {
  let params: Record<string, string> | null;
  try {
    params = await readValidatedTwilioForm(req);
  } catch (err) {
    if (err instanceof TwilioConfigError) {
      console.error("twilio/voice/status: config error", err);
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
    console.warn("twilio/voice/status: missing or malformed activityId");
    return new Response("OK", { status: 200 });
  }

  const status = params.CallStatus;
  if (!status || !FINAL_STATUSES.has(status)) {
    return new Response("OK", { status: 200 });
  }

  const patch = {
    status,
    durationSeconds: Number(params.CallDuration) || 0,
    childCallSid: params.CallSid ?? "",
  };
  const body = params.To ? `Call to ${params.To} — ${status}` : undefined;

  try {
    const rows = await mergeCallMetadata(activityId, patch, body);
    if (rows === 0) {
      console.warn("twilio/voice/status: no activity matched", activityId);
    }
  } catch (err) {
    console.error("twilio/voice/status: db error", err);
    return new Response("Error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
