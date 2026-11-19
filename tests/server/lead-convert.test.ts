import { test, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { testDb, resetDb, closeDb } from "../helpers/db";
import { callerFor, seedStages, seedUser } from "../helpers/caller";

beforeEach(resetDb);
after(closeDb);

async function setup() {
  const user = await seedUser("MEMBER");
  const api = await callerFor(user);
  await seedStages();
  const lead = await api.lead.create({ firstName: "Ada", lastName: "Lovelace", companyName: "Engines Ltd" });
  return { user, api, lead };
}

test("converting a lead creates one contact, one company and one deal, and audits it", async () => {
  const { api, lead } = await setup();
  const { contact, deal } = await api.lead.convert({ id: lead.id });

  assert.equal(await testDb.contact.count(), 1);
  assert.equal(await testDb.company.count(), 1);
  assert.equal(await testDb.deal.count(), 1);
  const after = await testDb.lead.findUniqueOrThrow({ where: { id: lead.id } });
  assert.equal(after.status, "CONVERTED");
  assert.equal(after.convertedContactId, contact.id);
  assert.equal(after.convertedDealId, deal.id);

  const audit = await testDb.auditLog.findMany({ where: { entityType: "LEAD", entityId: lead.id, action: "UPDATE" } });
  assert.equal(audit.length, 1);
  assert.deepEqual((audit[0].diff as { status?: string }).status, "CONVERTED");
});

test("converting the same lead again returns the existing contact and deal", async () => {
  const { api, lead } = await setup();
  const first = await api.lead.convert({ id: lead.id });
  const second = await api.lead.convert({ id: lead.id });

  assert.equal(second.contact.id, first.contact.id);
  assert.equal(second.deal.id, first.deal.id);
  assert.equal(await testDb.contact.count(), 1);
  assert.equal(await testDb.deal.count(), 1);
});

test("two concurrent conversions of one lead produce exactly one contact and one deal", async () => {
  const { api, lead } = await setup();
  const results = await Promise.all([api.lead.convert({ id: lead.id }), api.lead.convert({ id: lead.id })]);

  assert.equal(results[0].deal.id, results[1].deal.id);
  assert.equal(results[0].contact.id, results[1].contact.id);
  assert.equal(await testDb.contact.count(), 1);
  assert.equal(await testDb.company.count(), 1);
  assert.equal(await testDb.deal.count(), 1);
});

test("a converted lead cannot be moved back to another status", async () => {
  const { api, lead } = await setup();
  await api.lead.convert({ id: lead.id });
  await assert.rejects(api.lead.setStatus({ id: lead.id, status: "NEW" }), /already converted/);
  const after = await testDb.lead.findUniqueOrThrow({ where: { id: lead.id } });
  assert.equal(after.status, "CONVERTED");
});

test("setStatus cannot mark a lead converted without converting it", async () => {
  const { api, lead } = await setup();
  await assert.rejects(api.lead.setStatus({ id: lead.id, status: "CONVERTED" }), /Convert/);
  const after = await testDb.lead.findUniqueOrThrow({ where: { id: lead.id } });
  assert.equal(after.status, "NEW");
  assert.equal(await testDb.deal.count(), 0);
});
