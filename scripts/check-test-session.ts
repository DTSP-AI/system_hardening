import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import dotenv from "dotenv";
dotenv.config({
  path: "/tmp/claude-1000/-home-jpeezy/4606f730-bcc7-4192-bf03-667a864c683d/scratchpad/prod.env",
});
neonConfig.webSocketConstructor = ws;

import { PrismaClient } from "../generated/prisma/client";

async function main() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  const session = await prisma.callCoachingSession.findFirst({
    where: { callSid: process.argv[2] },
  });
  console.log(JSON.stringify(session, null, 2));
  await prisma.$disconnect();
}
main();
