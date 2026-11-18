import { prisma } from "@/lib/db";
import { readValidatedTwilioForm } from "@/lib/twilio/validate";

export async function POST(req: Request) {
  const params = await readValidatedTwilioForm(req);
  if (!params) {
    return new Response("Invalid signature", { status: 403 });
  }

  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenantId");
  const userId = url.searchParams.get("userId");
  const contactId = url.searchParams.get("contactId") || undefined;
  const dealId = url.searchParams.get("dealId") || undefined;
  // The parent-leg CallSid we minted in ../route.ts -- see the comment there
  // for why this (not params.CallSid, which is this child leg's own id) is
  // the value the recording webhook will later look this Activity up by.
  const callSid = url.searchParams.get("callSid") || params.CallSid;

  if (!tenantId || !userId) {
    return new Response("OK", { status: 200 });
  }

  const { CallStatus, CallDuration, To, From, Direction } = params;

  await prisma.activity.create({
    data: {
      tenantId,
      type: "CALL",
      contactId,
      dealId,
      authorId: userId,
      body: `Call to ${To} — ${CallStatus}`,
      metadata: {
        callSid,
        status: CallStatus,
        durationSeconds: CallDuration ? Number(CallDuration) : 0,
        to: To,
        from: From,
        direction: Direction,
      },
    },
  });

  return new Response("OK", { status: 200 });
}
