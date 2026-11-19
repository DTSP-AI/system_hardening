import { test, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { testDb, resetDb, closeDb } from "../helpers/db";

beforeEach(resetDb);
after(closeDb);

test("the test database has the migrated schema and starts empty", async () => {
  assert.equal(await testDb.deal.count(), 0);
  const stage = await testDb.pipelineStage.create({ data: { name: "New", sortOrder: 0 } });
  const deal = await testDb.deal.create({ data: { name: "Acme", stageId: stage.id } });
  assert.equal(deal.status, "OPEN");
});

test("src/lib/db reuses the test client instead of creating a Neon client", async () => {
  const { prisma } = await import("@/lib/db");
  assert.equal(prisma, testDb);
});
