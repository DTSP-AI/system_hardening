import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ sid: string }> }) {
  const { sid } = await params;
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { clerkOrgId: orgId } });
  if (!tenant) {
    return NextResponse.json({ error: "No tenant for this organization" }, { status: 404 });
  }

  // Recordings aren't public on Twilio's side -- confirm this tenant actually
  // owns an activity referencing this recording before proxying, so one
  // tenant can't fetch another's audio by guessing a RecordingSid.
  const owned = await prisma.activity.findFirst({
    where: { tenantId: tenant.id, type: "CALL", metadata: { path: ["recordingSid"], equals: sid } },
    select: { id: true },
  });
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return NextResponse.json({ error: "Calling is not configured" }, { status: 503 });
  }

  const twilioRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Recordings/${sid}.mp3`,
    { headers: { Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64")}` } },
  );

  if (!twilioRes.ok || !twilioRes.body) {
    return NextResponse.json({ error: "Recording unavailable" }, { status: 502 });
  }

  return new Response(twilioRes.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
