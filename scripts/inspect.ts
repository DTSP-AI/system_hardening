import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
neonConfig.webSocketConstructor = ws;

import { PrismaClient } from "../generated/prisma/client";

async function main() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const tenants = await prisma.tenant.findMany();
  console.log("TENANTS", JSON.stringify(tenants, null, 2));

  for (const t of tenants) {
    const stages = await prisma.pipelineStage.findMany({ where: { tenantId: t.id } });
    console.log(`STAGES for ${t.name}`, JSON.stringify(stages, null, 2));
    const memberships = await prisma.membership.findMany({ where: { tenantId: t.id } });
    console.log(`MEMBERSHIPS for ${t.name}`, JSON.stringify(memberships, null, 2));
  }

  await prisma.$disconnect();
}

main();
