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

  const statements = [
    `alter table "vendors" enable row level security`,
    `alter table "projects" enable row level security`,
    `alter table "project_commissions" enable row level security`,
    `alter table "service_tickets" enable row level security`,
    `create policy tenant_isolation_vendors on "vendors"
      using ("tenantId" = current_setting('app.current_tenant_id', true))`,
    `create policy tenant_isolation_projects on "projects"
      using ("tenantId" = current_setting('app.current_tenant_id', true))`,
    `create policy tenant_isolation_project_commissions on "project_commissions"
      using ("tenantId" = current_setting('app.current_tenant_id', true))`,
    `create policy tenant_isolation_service_tickets on "service_tickets"
      using ("tenantId" = current_setting('app.current_tenant_id', true))`,
  ];

  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
    console.log("OK:", sql.split("\n")[0]);
  }

  await prisma.$disconnect();
}

main();
