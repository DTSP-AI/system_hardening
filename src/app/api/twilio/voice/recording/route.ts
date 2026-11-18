import { prisma } from "@/lib/db";
import { readValidatedTwilioForm } from "@/lib/twilio/validate";

export async function POST(req: Request) {
  const params = await readValidatedTwilioForm(req);
  if (!params) {
    return new Response("Invalid signature", { status: 403 });
  }

  const url = new URL(req.url);
  const { RecordingSid, RecordingDuration, RecordingStatus } = params;
  // Twilio's own params.CallSid here is the PARENT leg -- see the comment in
  // ../route.ts -- which happens to match what we minted, but read the
  // query param first since it's the value we control and status/route.ts
  // stored under metadata.callSid.
  const CallSid = url.searchParams.get("callSid") || params.CallSid;

  if (!CallSid || !RecordingSid || RecordingStatus !== "completed") {
    return new Response("OK", { status: 200 });
  }

  const recordingMeta = {
    recordingSid: RecordingSid,
    recordingDurationSeconds: RecordingDuration ? Number(RecordingDuration) : 0,
  };

  // The Activity row for this call is normally created moments earlier by
  // /api/twilio/voice/status (Number-level statusCallback); the Dial-level
  // recording callback isn't guaranteed to fire after it, so fall back to
  // creating a bare CALL activity if no match is found yet.
  const existing = await prisma.activity.findFirst({
    where: { type: "CALL", metadata: { path: ["callSid"], equals: CallSid } },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    await prisma.activity.update({
      where: { id: existing.id },
      data: { metadata: { ...(existing.metadata as object), ...recordingMeta } },
    });
  } else {
    await prisma.activity.create({
      data: {
        type: "CALL",
        authorId: "system",
        body: "Call recording",
        metadata: { callSid: CallSid, ...recordingMeta },
      },
    });
  }

  return new Response("OK", { status: 200 });
}
