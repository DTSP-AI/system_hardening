import { scopedDb } from "@/lib/db";
import type { Prisma } from "@generated/prisma/client";

/**
 * Relay -> CRM persistence callback. No Clerk session exists on this path (the
 * caller is the standalone coaching relay service, not a browser), so trust is
 * established via a shared secret header instead, mirroring the existing
 * /api/twilio/voice callbacks (which use Twilio's own signature instead of Clerk).
 * tenantId comes from the request body, which the relay derived from its own
 * verified handshake token payload -- there is no session to read it from here.
 */
export async function PATCH(req: Request) {
  if (req.headers.get("x-coaching-relay-secret") !== process.env.COACHING_RELAY_SHARED_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await req.json()) as {
    tenantId: string;
    callSid: string;
    transcriptAppend?: unknown[];
    tipsAppend?: unknown[];
    ended?: boolean;
    errored?: boolean;
  };
  const { tenantId, callSid, transcriptAppend, tipsAppend, ended, errored } = body;

  const scoped = scopedDb(tenantId);

  await scoped.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;

    const session = await tx.callCoachingSession.findFirst({ where: { callSid } });
    if (!session) return;

    const transcript = session.transcript as unknown[];
    const tips = session.tips as unknown[];

    const data: Prisma.CallCoachingSessionUpdateInput = {};
    if (transcriptAppend?.length) {
      data.transcript = [...transcript, ...transcriptAppend] as Prisma.InputJsonValue;
    }
    if (tipsAppend?.length) {
      data.tips = [...tips, ...tipsAppend] as Prisma.InputJsonValue;
    }
    if (ended) {
      data.status = "ENDED";
      data.endedAt = new Date();
    } else if (errored) {
      data.status = "ERROR";
      data.endedAt = new Date();
    }

    await tx.callCoachingSession.update({ where: { id: session.id }, data });
  });

  return Response.json({ ok: true });
}
