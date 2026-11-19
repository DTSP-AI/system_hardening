import { test, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { testDb, resetDb, closeDb } from "../helpers/db";
import { callerFor, seedStages, seedUser } from "../helpers/caller";

beforeEach(resetDb);
after(closeDb);

async function setup() {
  const user = await seedUser("MEMBER");
  const api = await callerFor(user);
  const stages = await seedStages();
  return { user, api, stages };
}

test("creating a deal in a Won stage gives status WON with a close date", async () => {
  const { api, stages } = await setup();
  const deal = await api.deal.create({ name: "Acme", stageId: stages.won.id });
  assert.equal(deal.status, "WON");
  assert.ok(deal.closedAt);
});

test("creating a deal in a Lost stage gives status LOST; in an open stage OPEN with no close date", async () => {
  const { api, stages } = await setup();
  const lost = await api.deal.create({ name: "Lost one", stageId: stages.lost.id });
  assert.equal(lost.status, "LOST");
  assert.ok(lost.closedAt);
  const open = await api.deal.create({ name: "Open one", stageId: stages.open.id });
  assert.equal(open.status, "OPEN");
  assert.equal(open.closedAt, null);
});

test("deal.update cannot change the stage", async () => {
  const { api, stages } = await setup();
  const deal = await api.deal.create({ name: "Acme", stageId: stages.open.id });
  // stageId is no longer part of the update contract; a client that still sends it changes nothing.
  await api.deal.update({ id: deal.id, name: "Acme 2", stageId: stages.won.id } as never);
  const after = await testDb.deal.findUniqueOrThrow({ where: { id: deal.id } });
  assert.equal(after.name, "Acme 2");
  assert.equal(after.stageId, stages.open.id);
  assert.equal(after.status, "OPEN");
});

test("a deal converted to an account cannot change stage by moveStage or moveStageMany", async () => {
  const { api, stages } = await setup();
  const deal = await api.deal.create({ name: "Acme", stageId: stages.open.id });
  await api.deal.moveStage({ id: deal.id, stageId: stages.won.id });
  await api.deal.convertToAccount({ id: deal.id });

  await assert.rejects(api.deal.moveStage({ id: deal.id, stageId: stages.open.id }), /converted to an account/);
  await assert.rejects(
    api.deal.moveStageMany({ ids: [deal.id], stageId: stages.open.id }),
    /converted to an account/,
  );
  const after = await testDb.deal.findUniqueOrThrow({ where: { id: deal.id } });
  assert.equal(after.stageId, stages.won.id);
  assert.equal(after.status, "WON");
});

test("moveStageMany refuses the whole batch when one deal is converted", async () => {
  const { api, stages } = await setup();
  const converted = await api.deal.create({ name: "Converted", stageId: stages.won.id });
  await api.deal.convertToAccount({ id: converted.id });
  const free = await api.deal.create({ name: "Free", stageId: stages.open.id });

  await assert.rejects(api.deal.moveStageMany({ ids: [free.id, converted.id], stageId: stages.open2.id }));
  const after = await testDb.deal.findUniqueOrThrow({ where: { id: free.id } });
  assert.equal(after.stageId, stages.open.id);
});

test("moveStageMany sets status and writes one audit row per deal", async () => {
  const { api, stages } = await setup();
  const a = await api.deal.create({ name: "A", stageId: stages.open.id });
  const b = await api.deal.create({ name: "B", stageId: stages.open.id });
  const before = await testDb.auditLog.count({ where: { entityType: "DEAL", action: "UPDATE" } });

  const result = await api.deal.moveStageMany({ ids: [a.id, b.id], stageId: stages.won.id });
  assert.equal(result.count, 2);

  const rows = await testDb.deal.findMany({ where: { id: { in: [a.id, b.id] } } });
  for (const row of rows) {
    assert.equal(row.status, "WON");
    assert.ok(row.closedAt);
  }
  const afterCount = await testDb.auditLog.count({ where: { entityType: "DEAL", action: "UPDATE" } });
  assert.equal(afterCount - before, 2);
});

test("moving back from Won to an open stage reopens the deal", async () => {
  const { api, stages } = await setup();
  const deal = await api.deal.create({ name: "Acme", stageId: stages.won.id });
  const moved = await api.deal.moveStage({ id: deal.id, stageId: stages.open.id });
  assert.equal(moved.status, "OPEN");
  assert.equal(moved.closedAt, null);
});
