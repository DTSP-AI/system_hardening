import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import dotenv from "dotenv";
import { createHmac } from "node:crypto";
dotenv.config({
  path: "/tmp/claude-1000/-home-jpeezy/4606f730-bcc7-4192-bf03-667a864c683d/scratchpad/prod.env",
});
// COACHING_RELAY_SHARED_SECRET pulls empty from Vercel (marked sensitive/write-only there) --
// this is the same value read back from the Railway relay's own env instead.
dotenv.config({
  path: "/tmp/claude-1000/-home-jpeezy/4606f730-bcc7-4192-bf03-667a864c683d/scratchpad/relay_test.env",
  override: true,
});
neonConfig.webSocketConstructor = ws;

import { PrismaClient } from "../generated/prisma/client";

function signCoachingToken(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", process.env.COACHING_RELAY_SHARED_SECRET!).update(body).digest("hex");
  return `${body}.${sig}`;
}

async function main() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const membership = await prisma.membership.findFirst({ orderBy: { createdAt: "asc" } });
  if (!membership) throw new Error("No membership found to attach test session to");
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: membership.tenantId } });

  const callSid = `TEST_CALL_${Date.now()}`;

  await prisma.callCoachingSession.create({
    data: {
      tenantId: tenant.id,
      callSid,
      userId: membership.clerkUserId,
    },
  });

  const payload = {
    tenantId: tenant.id,
    userId: membership.clerkUserId,
    callSid,
    exp: Date.now() + 15 * 60_000,
  };
  const token = signCoachingToken(payload);

  console.log(JSON.stringify({ tenantId: tenant.id, userId: membership.clerkUserId, callSid, token }, null, 2));

  await prisma.$disconnect();
}

main();
