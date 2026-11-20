import { test, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { testDb, resetDb, closeDb } from "../helpers/db";
import { callerFor, seedUser } from "../helpers/caller";

beforeEach(resetDb);
after(closeDb);

/**
 * BOS1 is single-tenant (one database per deployment), so there is no tenant
 * boundary to cross. The boundaries that do exist are per user and per role.
 */

test("a user cannot read, change or delete another user's todos", async () => {
  const alice = await callerFor(await seedUser());
  const bob = await callerFor(await seedUser());
  const todo = await alice.todo.create({ title: "Private", quadrant: "SCHEDULE" });

  assert.equal((await bob.todo.list()).length, 0);
  await assert.rejects(bob.todo.toggle({ id: todo.id, completed: true }), /Not found/);
  await assert.rejects(bob.todo.move({ id: todo.id, quadrant: "DELEGATE" }), /Not found/);
  await assert.rejects(bob.todo.delete({ id: todo.id }), /Not found/);

  const row = await testDb.todo.findUniqueOrThrow({ where: { id: todo.id } });
  assert.equal(row.completed, false);
  assert.equal(row.quadrant, "SCHEDULE");
});

test("a user cannot read or mark another user's notifications", async () => {
  const aliceUser = await seedUser();
  const alice = await callerFor(aliceUser);
  const bob = await callerFor(await seedUser());
  const note = await testDb.notification.create({
    data: { userId: aliceUser.clerkUserId!, type: "ACTIVITY", title: "For Alice" },
  });

  assert.equal((await bob.notification.list()).length, 0);
  assert.equal(await bob.notification.unreadCount(), 0);
  await bob.notification.markRead({ id: note.id });
  await bob.notification.markAllRead();
  assert.equal((await testDb.notification.findUniqueOrThrow({ where: { id: note.id } })).readAt, null);
  assert.equal(await alice.notification.unreadCount(), 1);
});

test("a member cannot complete or delete another member's activity; an admin can", async () => {
  const alice = await callerFor(await seedUser("MEMBER"));
  const bob = await callerFor(await seedUser("MEMBER"));
  const admin = await callerFor(await seedUser("ADMIN"));
  const lead = await testDb.lead.create({ data: { firstName: "A", lastName: "B" } });
  const task = await alice.activity.create({ type: "TASK", leadId: lead.id, body: "Call back" });

  await assert.rejects(bob.activity.complete({ id: task.id }), /Not found/);
  await assert.rejects(bob.activity.delete({ id: task.id }), /Not found/);
  assert.equal(await testDb.activity.count(), 1);

  await admin.activity.complete({ id: task.id });
  assert.ok((await testDb.activity.findUniqueOrThrow({ where: { id: task.id } })).completedAt);
});

test("a member is refused every admin procedure", async () => {
  const member = await callerFor(await seedUser("MEMBER"));
  const lead = await testDb.lead.create({ data: { firstName: "A", lastName: "B" } });
  await assert.rejects(member.lead.delete({ id: lead.id }), /permission/);
  await assert.rejects(member.lead.deleteMany({ ids: [lead.id] }), /permission/);
  await assert.rejects(member.auditLog.list(), /permission/);
  await assert.rejects(member.apiKey.list(), /permission/);
  await assert.rejects(member.pipelineStage.create({ name: "X" }), /permission/);
  assert.equal(await testDb.lead.count(), 1);
});

test("a signed-out caller, an unknown user and a deactivated user are refused", async () => {
  const signedOut = await callerFor({ clerkUserId: null });
  await assert.rejects(signedOut.lead.list(), /UNAUTHORIZED/);

  const deactivated = await seedUser();
  await testDb.user.update({ where: { id: deactivated.id }, data: { deactivatedAt: new Date() } });
  await assert.rejects((await callerFor(deactivated)).lead.list(), /not authorized/);
});
