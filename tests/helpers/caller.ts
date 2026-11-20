/**
 * tRPC callers for server tests. Importing this file installs the test database
 * client first (./db), so the routers below run against local Postgres.
 */
import { testDb } from "./db";
import type { UserRole } from "../../generated/prisma/client";

let seq = 0;

export async function seedUser(role: UserRole = "MEMBER") {
  seq += 1;
  return testDb.user.create({
    data: { email: `user${seq}-${Date.now()}@example.test`, clerkUserId: `clerk_test_${seq}_${Date.now()}`, role },
  });
}

/** A caller signed in as the given app user (already linked to a Clerk id). */
export async function callerFor(user: { clerkUserId: string | null }) {
  const { appRouter } = await import("@/server/api/root");
  return appRouter.createCaller({ userId: user.clerkUserId, prisma: testDb });
}

export async function seedStages() {
  const open = await testDb.pipelineStage.create({ data: { name: "Qualified", sortOrder: 0 } });
  const open2 = await testDb.pipelineStage.create({ data: { name: "Proposal", sortOrder: 1 } });
  const won = await testDb.pipelineStage.create({ data: { name: "Won", sortOrder: 2, isWon: true } });
  const lost = await testDb.pipelineStage.create({ data: { name: "Lost", sortOrder: 3, isLost: true } });
  return { open, open2, won, lost };
}
