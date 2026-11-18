import { NextResponse } from "next/server";
import { requireAppUserForRoute } from "@/lib/auth/app-user";
import { prisma } from "@/lib/db";

const RECORDING_SID_RE = /^RE[0-9a-f]{32}$/;

export async function GET(_req: Request, { params }: { params: Promise<{ sid: string }> }) {
  const guard = await requireAppUserForRoute();
  if (guard instanceof Response) return guard;
  const { sid } = await params;

  // Format check before any DB work.
  if (!RECORDING_SID_RE.test(sid)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Recordings aren't public on Twilio's side -- confirm an activity
  // actually references this recording before proxying, so audio can't be
  // fetched by guessing a RecordingSid.
  let owned: { id: string } | null;
  try {
    owned = await prisma.activity.findFirst({
      where: { type: "CALL", metadata: { path: ["recordingSid"], equals: sid } },
      select: { id: true },
    });
  } catch (err) {
    console.error("twilio/recording: lookup failed", err);
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return NextResponse.json({ error: "Calling is not configured" }, { status: 503 });
  }

  let twilioRes: Response;
  try {
    twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Recordings/${sid}.mp3`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64")}`,
        },
        signal: AbortSignal.timeout(10_000),
      },
    );
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    console.error("twilio/recording: fetch failed", err);
    return NextResponse.json(
      { error: timedOut ? "Recording fetch timed out" : "Recording unavailable" },
      { status: timedOut ? 504 : 502 },
    );
  }

  if (twilioRes.status === 404) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!twilioRes.ok || !twilioRes.body) {
    return NextResponse.json({ error: "Recording unavailable" }, { status: 502 });
  }

  return new Response(twilioRes.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, no-store",
    },
  });
}
