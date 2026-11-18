import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ sid: string }> }) {
  const { sid } = await params;
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Recordings aren't public on Twilio's side -- confirm an activity
  // actually references this recording before proxying, so audio can't be
  // fetched by guessing a RecordingSid.
  const owned = await prisma.activity.findFirst({
    where: { type: "CALL", metadata: { path: ["recordingSid"], equals: sid } },
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
