import { test, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { testDb, resetDb, closeDb } from "../helpers/db";
import { callerFor, seedUser } from "../helpers/caller";
import { hasScope, resolveApiKey } from "@/lib/auth/api-key";

beforeEach(resetDb);
after(closeDb);

async function mintKey(scopes: Array<"read" | "write">) {
  const admin = await seedUser("ADMIN");
  const api = await callerFor(admin);
  const created = await api.apiKey.create({ name: "agent", scopes });
  return { admin, api, ...created };
}

test("a valid key resolves to a principal with its scopes and stamps lastUsedAt", async () => {
  const { id, key } = await mintKey(["read"]);
  const result = await resolveApiKey(`Bearer ${key}`);
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(result.principal.id, id);
  assert.equal(result.principal.actorId, `apikey:${id}`);
  assert.deepEqual(result.principal.scopes, ["read"]);
  const row = await testDb.apiKey.findUniqueOrThrow({ where: { id } });
  assert.ok(row.lastUsedAt);
});

test("a missing header, a malformed header and an unknown key are unauthorized", async () => {
  await mintKey(["read"]);
  assert.equal((await resolveApiKey(null)).status, "unauthorized");
  assert.equal((await resolveApiKey("")).status, "unauthorized");
  assert.equal((await resolveApiKey("Basic abc")).status, "unauthorized");
  assert.equal((await resolveApiKey("Bearer not-a-bos1-key")).status, "unauthorized");
  assert.equal((await resolveApiKey("Bearer bos1_" + "x".repeat(32))).status, "unauthorized");
});

test("a revoked key is unauthorized", async () => {
  const { api, id, key } = await mintKey(["read", "write"]);
  await api.apiKey.revoke({ id });
  assert.equal((await resolveApiKey(`Bearer ${key}`)).status, "unauthorized");
});

test("an expired key is unauthorized", async () => {
  const { id, key } = await mintKey(["read"]);
  await testDb.apiKey.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await resolveApiKey(`Bearer ${key}`)).status, "unauthorized");
});

test("a key with no scopes is unauthorized", async () => {
  const { id, key } = await mintKey(["read"]);
  await testDb.apiKey.update({ where: { id }, data: { scopes: [] } });
  assert.equal((await resolveApiKey(`Bearer ${key}`)).status, "unauthorized");
});

test("the write scope includes read; the read scope does not include write", () => {
  assert.equal(hasScope({ scopes: ["write"] }, "read"), true);
  assert.equal(hasScope({ scopes: ["write"] }, "write"), true);
  assert.equal(hasScope({ scopes: ["read"] }, "read"), true);
  assert.equal(hasScope({ scopes: ["read"] }, "write"), false);
});

test("a key is rate limited per key", async () => {
  const { key } = await mintKey(["read"]);
  const limits = [{ windowMs: 60_000, max: 2 }];
  assert.equal((await resolveApiKey(`Bearer ${key}`, limits)).status, "ok");
  assert.equal((await resolveApiKey(`Bearer ${key}`, limits)).status, "ok");
  const third = await resolveApiKey(`Bearer ${key}`, limits);
  assert.equal(third.status, "rate_limited");
});

test("creating a key requires at least one scope and stores only the hash", async () => {
  const admin = await seedUser("ADMIN");
  const api = await callerFor(admin);
  await assert.rejects(api.apiKey.create({ name: "agent", scopes: [] }));
  const { id, key } = await api.apiKey.create({ name: "agent", scopes: ["read"] });
  const row = await testDb.apiKey.findUniqueOrThrow({ where: { id } });
  assert.notEqual(row.hashedKey, key);
  assert.deepEqual(row.scopes, ["read"]);
});

test("key creation and revocation write audit rows without the key or its hash", async () => {
  const { api, id, key } = await mintKey(["read", "write"]);
  await api.apiKey.revoke({ id });
  const rows = await testDb.auditLog.findMany({ where: { entityType: "API_KEY", entityId: id }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(rows.map((r) => r.action), ["CREATE", "UPDATE"]);
  const text = JSON.stringify(rows);
  assert.equal(text.includes(key), false);
  const row = await testDb.apiKey.findUniqueOrThrow({ where: { id } });
  assert.equal(text.includes(row.hashedKey), false);
});

test("a member cannot create a key; the list shows scopes and never the hash", async () => {
  const member = await callerFor(await seedUser("MEMBER"));
  await assert.rejects(member.apiKey.create({ name: "agent", scopes: ["read"] }), /permission/);
  const { api } = await mintKey(["read"]);
  const list = await api.apiKey.list();
  assert.equal(list.length, 1);
  assert.deepEqual(list[0].scopes, ["read"]);
  assert.equal("hashedKey" in list[0], false);
});
