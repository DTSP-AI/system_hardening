import { test, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { testDb, resetDb, closeDb } from "../helpers/db";
import { callerFor, seedStages, seedUser } from "../helpers/caller";
import { dataOf, mcpCall, mcpListTools, mintApiKey } from "../helpers/mcp";

beforeEach(resetDb);
after(closeDb);

function errorCode(envelope: Awaited<ReturnType<typeof mcpCall>>["envelope"]): string | null {
  return envelope.success ? null : envelope.error.code;
}

test("the write tools are registered", async () => {
  const { key } = await mintApiKey(["read"]);
  const tools = await mcpListTools(key);
  for (const name of ["bos1_create_lead", "bos1_log_activity", "bos1_move_deal_stage", "bos1_convert_lead"]) {
    assert.ok(tools.includes(name), `${name} is registered`);
  }
});

test("a read-only key is refused on every write tool and nothing is written", async () => {
  const { key } = await mintApiKey(["read"]);
  const stages = await seedStages();
  const lead = await testDb.lead.create({ data: { firstName: "Ada", lastName: "L" } });
  const deal = await testDb.deal.create({ data: { name: "Acme", stageId: stages.open.id } });

  const calls: Array<[string, Record<string, unknown>]> = [
    ["bos1_create_lead", { idempotencyKey: "k-create-1", firstName: "X", lastName: "Y" }],
    ["bos1_log_activity", { idempotencyKey: "idem-k-log-1", type: "NOTE", entityType: "LEAD", entityId: lead.id, body: "hi" }],
    ["bos1_move_deal_stage", { idempotencyKey: "idem-k-move-1", dealId: deal.id, stageId: stages.won.id }],
    ["bos1_convert_lead", { idempotencyKey: "idem-k-conv-1", leadId: lead.id }],
  ];
  for (const [name, args] of calls) {
    const res = await mcpCall(key, name, args);
    assert.equal(res.isError, true, `${name} must be refused`);
    assert.equal(errorCode(res.envelope), "forbidden", `${name} must return forbidden`);
  }

  assert.equal(await testDb.lead.count(), 1);
  assert.equal(await testDb.activity.count(), 0);
  assert.equal(await testDb.contact.count(), 0);
  assert.equal(await testDb.idempotencyKey.count(), 0);
  const after = await testDb.deal.findUniqueOrThrow({ where: { id: deal.id } });
  assert.equal(after.stageId, stages.open.id);
});

test("create_lead writes the lead and an audit row attributed to the API key", async () => {
  const { key, actorId } = await mintApiKey(["write"]);
  const res = await mcpCall(key, "bos1_create_lead", {
    idempotencyKey: "lead-0001",
    firstName: "Grace",
    lastName: "Hopper",
    email: "grace@example.test",
    companyName: "Navy",
  });
  const lead = dataOf<{ id: string; firstName: string; status: string }>(res.envelope);
  assert.equal(lead.firstName, "Grace");
  assert.equal(lead.status, "NEW");

  const audit = await testDb.auditLog.findMany({ where: { entityType: "LEAD", entityId: lead.id } });
  assert.equal(audit.length, 1);
  assert.equal(audit[0].actorId, actorId);
  assert.equal(audit[0].action, "CREATE");
});

test("a write repeated with the same idempotency key returns the first result and acts once", async () => {
  const { key } = await mintApiKey(["write"]);
  const args = { idempotencyKey: "lead-dup-1", firstName: "Grace", lastName: "Hopper" };
  const first = dataOf<{ id: string }>((await mcpCall(key, "bos1_create_lead", args)).envelope);
  const second = dataOf<{ id: string }>((await mcpCall(key, "bos1_create_lead", args)).envelope);
  assert.equal(second.id, first.id);
  assert.equal(await testDb.lead.count(), 1);
  assert.equal(await testDb.auditLog.count({ where: { entityType: "LEAD" } }), 1);
});

test("two concurrent writes with the same idempotency key act once", async () => {
  const { key } = await mintApiKey(["write"]);
  const args = { idempotencyKey: "lead-race-1", firstName: "Grace", lastName: "Hopper" };
  const [a, b] = await Promise.all([mcpCall(key, "bos1_create_lead", args), mcpCall(key, "bos1_create_lead", args)]);
  assert.equal(dataOf<{ id: string }>(a.envelope).id, dataOf<{ id: string }>(b.envelope).id);
  assert.equal(await testDb.lead.count(), 1);
});

test("a different idempotency key is a different write, and keys are per API key", async () => {
  const one = await mintApiKey(["write"], "agent one");
  const two = await mintApiKey(["write"], "agent two");
  await mcpCall(one.key, "bos1_create_lead", { idempotencyKey: "same-key-0001", firstName: "A", lastName: "A" });
  await mcpCall(one.key, "bos1_create_lead", { idempotencyKey: "other-key", firstName: "B", lastName: "B" });
  await mcpCall(two.key, "bos1_create_lead", { idempotencyKey: "same-key-0001", firstName: "C", lastName: "C" });
  assert.equal(await testDb.lead.count(), 3);
});

test("a write without an idempotency key is refused", async () => {
  const { key } = await mintApiKey(["write"]);
  const res = await mcpCall(key, "bos1_create_lead", { firstName: "A", lastName: "B" });
  assert.equal(res.isError, true);
  assert.equal(await testDb.lead.count(), 0);
});

test("log_activity records a note authored by the API key and refuses a missing record or a CALL", async () => {
  const { key, actorId } = await mintApiKey(["write"]);
  const lead = await testDb.lead.create({ data: { firstName: "Ada", lastName: "L" } });

  const res = await mcpCall(key, "bos1_log_activity", {
    idempotencyKey: "idem-note-1",
    type: "NOTE",
    entityType: "LEAD",
    entityId: lead.id,
    body: "Called back, wants a quote",
  });
  const activity = dataOf<{ id: string; type: string }>(res.envelope);
  assert.equal(activity.type, "NOTE");
  const row = await testDb.activity.findUniqueOrThrow({ where: { id: activity.id } });
  assert.equal(row.authorId, actorId);
  assert.equal(row.leadId, lead.id);

  const missing = await mcpCall(key, "bos1_log_activity", {
    idempotencyKey: "idem-note-2",
    type: "NOTE",
    entityType: "LEAD",
    entityId: "nope",
    body: "x",
  });
  assert.equal(errorCode(missing.envelope), "not_found");

  const call = await mcpCall(key, "bos1_log_activity", {
    idempotencyKey: "idem-note-3",
    type: "CALL",
    entityType: "LEAD",
    entityId: lead.id,
    body: "fake call",
  });
  assert.equal(call.isError, true);
  assert.equal(await testDb.activity.count(), 1);
});

test("move_deal_stage follows the stage rules: status is set and a converted deal is refused", async () => {
  const { key, actorId } = await mintApiKey(["write"]);
  const stages = await seedStages();
  const deal = await testDb.deal.create({ data: { name: "Acme", stageId: stages.open.id } });

  const moved = dataOf<{ status: string; closedAt: string | null }>(
    (await mcpCall(key, "bos1_move_deal_stage", { idempotencyKey: "idem-move-1", dealId: deal.id, stageId: stages.won.id }))
      .envelope,
  );
  assert.equal(moved.status, "WON");
  assert.ok(moved.closedAt);
  const audit = await testDb.auditLog.findFirst({ where: { entityType: "DEAL", entityId: deal.id } });
  assert.equal(audit?.actorId, actorId);

  const api = await callerFor(await seedUser());
  await api.deal.convertToAccount({ id: deal.id });
  const refused = await mcpCall(key, "bos1_move_deal_stage", {
    idempotencyKey: "idem-move-2",
    dealId: deal.id,
    stageId: stages.open.id,
  });
  assert.equal(errorCode(refused.envelope), "conflict");
  const after = await testDb.deal.findUniqueOrThrow({ where: { id: deal.id } });
  assert.equal(after.stageId, stages.won.id);

  const missing = await mcpCall(key, "bos1_move_deal_stage", {
    idempotencyKey: "idem-move-3",
    dealId: "nope",
    stageId: stages.open.id,
  });
  assert.equal(errorCode(missing.envelope), "not_found");
});

test("convert_lead converts once: a second call with a new idempotency key returns the same records", async () => {
  const { key } = await mintApiKey(["write"]);
  await seedStages();
  const lead = await testDb.lead.create({ data: { firstName: "Ada", lastName: "L", companyName: "Engines" } });

  type Converted = { contact: { id: string }; deal: { id: string } };
  const first = dataOf<Converted>(
    (await mcpCall(key, "bos1_convert_lead", { idempotencyKey: "idem-conv-1", leadId: lead.id })).envelope,
  );
  const second = dataOf<Converted>(
    (await mcpCall(key, "bos1_convert_lead", { idempotencyKey: "idem-conv-2", leadId: lead.id })).envelope,
  );
  assert.equal(second.deal.id, first.deal.id);
  assert.equal(second.contact.id, first.contact.id);
  assert.equal(await testDb.deal.count(), 1);
  assert.equal(await testDb.contact.count(), 1);
});

test("a write that fails stores no idempotency result, so it can be retried", async () => {
  const { key } = await mintApiKey(["write"]);
  const lead = await testDb.lead.create({ data: { firstName: "Ada", lastName: "L" } });
  // No pipeline stage yet: conversion fails.
  const failed = await mcpCall(key, "bos1_convert_lead", { idempotencyKey: "conv-retry", leadId: lead.id });
  assert.equal(failed.isError, true);
  assert.equal(await testDb.idempotencyKey.count(), 0);
  assert.equal((await testDb.lead.findUniqueOrThrow({ where: { id: lead.id } })).status, "NEW");

  await seedStages();
  const retried = await mcpCall(key, "bos1_convert_lead", { idempotencyKey: "conv-retry", leadId: lead.id });
  assert.equal(retried.envelope.success, true);
});

test("an idempotency key reused with different arguments is refused, not answered with the old result", async () => {
  const { key } = await mintApiKey(["write"]);
  await seedStages();
  const leadA = await testDb.lead.create({ data: { firstName: "A", lastName: "A" } });
  const leadB = await testDb.lead.create({ data: { firstName: "B", lastName: "B" } });

  const first = await mcpCall(key, "bos1_convert_lead", { idempotencyKey: "reused-key-1", leadId: leadA.id });
  assert.equal(first.envelope.success, true);
  const second = await mcpCall(key, "bos1_convert_lead", { idempotencyKey: "reused-key-1", leadId: leadB.id });
  assert.equal(second.isError, true);
  assert.equal(errorCode(second.envelope), "conflict");
  assert.equal((await testDb.lead.findUniqueOrThrow({ where: { id: leadB.id } })).status, "NEW");
});

test("log_activity and convert_lead write audit rows attributed to the API key", async () => {
  const { key, actorId } = await mintApiKey(["write"]);
  await seedStages();
  const lead = await testDb.lead.create({ data: { firstName: "Ada", lastName: "L" } });
  await mcpCall(key, "bos1_log_activity", {
    idempotencyKey: "audit-note-1",
    type: "NOTE",
    entityType: "LEAD",
    entityId: lead.id,
    body: "note",
  });
  await mcpCall(key, "bos1_convert_lead", { idempotencyKey: "audit-conv-1", leadId: lead.id });
  const activityAudit = await testDb.auditLog.findFirst({ where: { entityType: "ACTIVITY" } });
  assert.equal(activityAudit?.actorId, actorId);
  const leadAudit = await testDb.auditLog.findFirst({ where: { entityType: "LEAD", entityId: lead.id } });
  assert.equal(leadAudit?.actorId, actorId);
});
