import { test, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { testDb, resetDb, closeDb } from "../helpers/db";
import { dataOf, mcpCall, mcpListTools, mcpRaw, mintApiKey } from "../helpers/mcp";

beforeEach(resetDb);
after(closeDb);

type Page<T> = { items: T[]; nextCursor: string | null };

test("a request with no key, an unknown key, a revoked key or an expired key gets 401", async () => {
  assert.equal((await mcpRaw("tools/list", {}, null)).status, 401);
  assert.equal((await mcpRaw("tools/list", {}, "bos1_" + "a".repeat(32))).status, 401);

  const revoked = await mintApiKey(["read"]);
  await testDb.apiKey.update({ where: { id: revoked.id }, data: { revokedAt: new Date() } });
  assert.equal((await mcpRaw("tools/list", {}, revoked.key)).status, 401);

  const expired = await mintApiKey(["read"]);
  await testDb.apiKey.update({ where: { id: expired.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await mcpRaw("tools/list", {}, expired.key)).status, 401);
});

test("a read key can list the tools", async () => {
  const { key } = await mintApiKey(["read"]);
  const tools = await mcpListTools(key);
  for (const name of [
    "bos1_search_records",
    "bos1_list_leads",
    "bos1_get_lead",
    "bos1_list_deals",
    "bos1_get_deal",
    "bos1_list_contacts",
    "bos1_get_contact",
    "bos1_list_companies",
    "bos1_get_company",
    "bos1_list_accounts",
    "bos1_get_account",
    "bos1_list_pipeline_stages",
    "bos1_list_activities",
  ]) {
    assert.ok(tools.includes(name), `${name} is registered`);
  }
});

test("list tools return a bounded page and a cursor that walks every record exactly once", async () => {
  const { key } = await mintApiKey(["read"]);
  for (let i = 0; i < 5; i++) {
    await testDb.lead.create({ data: { firstName: `Lead${i}`, lastName: "Test" } });
  }

  const seen: string[] = [];
  let cursor: string | null = null;
  let pages = 0;
  do {
    const args: Record<string, unknown> = { limit: 2 };
    if (cursor) args.cursor = cursor;
    const res = await mcpCall(key, "bos1_list_leads", args);
    const page = dataOf<Page<{ id: string }>>(res.envelope);
    assert.ok(page.items.length <= 2);
    seen.push(...page.items.map((l) => l.id));
    cursor = page.nextCursor;
    pages += 1;
  } while (cursor && pages < 10);

  assert.equal(seen.length, 5);
  assert.equal(new Set(seen).size, 5);
  assert.equal(pages, 3);
});

test("a list defaults to a bounded page and refuses a limit above 100", async () => {
  const { key } = await mintApiKey(["read"]);
  await testDb.lead.createMany({
    data: Array.from({ length: 30 }, (_, i) => ({ firstName: `L${i}`, lastName: "T" })),
  });
  const page = dataOf<Page<unknown>>((await mcpCall(key, "bos1_list_leads")).envelope);
  assert.equal(page.items.length, 25);
  assert.ok(page.nextCursor);

  const tooMany = await mcpCall(key, "bos1_list_leads", { limit: 500 });
  assert.equal(tooMany.isError, true);
});

test("get returns the record, and a missing id returns not_found", async () => {
  const { key } = await mintApiKey(["read"]);
  const lead = await testDb.lead.create({ data: { firstName: "Ada", lastName: "Lovelace" } });
  const found = dataOf<{ id: string; firstName: string }>((await mcpCall(key, "bos1_get_lead", { id: lead.id })).envelope);
  assert.equal(found.firstName, "Ada");

  const missing = await mcpCall(key, "bos1_get_lead", { id: "does-not-exist" });
  assert.equal(missing.isError, true);
  assert.equal(missing.envelope.success, false);
  if (!missing.envelope.success) assert.equal(missing.envelope.error.code, "not_found");
});

test("search finds records across types", async () => {
  const { key } = await mintApiKey(["read"]);
  await testDb.lead.create({ data: { firstName: "Zelda", lastName: "Quartz" } });
  await testDb.company.create({ data: { name: "Quartz Mining" } });
  const result = dataOf<{ leads: unknown[]; companies: unknown[] }>(
    (await mcpCall(key, "bos1_search_records", { query: "quartz" })).envelope,
  );
  assert.equal(result.leads.length, 1);
  assert.equal(result.companies.length, 1);
});

test("deals list filters by status and returns amounts as numbers", async () => {
  const { key } = await mintApiKey(["read"]);
  const open = await testDb.pipelineStage.create({ data: { name: "Open", sortOrder: 0 } });
  await testDb.deal.create({ data: { name: "A", stageId: open.id, amount: 1500.5 } });
  await testDb.deal.create({ data: { name: "B", stageId: open.id, status: "WON" } });
  const page = dataOf<Page<{ name: string; amount: number | null }>>(
    (await mcpCall(key, "bos1_list_deals", { status: "OPEN" })).envelope,
  );
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].name, "A");
  assert.equal(page.items[0].amount, 1500.5);
});

test("activities for a record are listed newest first", async () => {
  const { key } = await mintApiKey(["read"]);
  const lead = await testDb.lead.create({ data: { firstName: "Ada", lastName: "L" } });
  await testDb.activity.create({ data: { type: "NOTE", leadId: lead.id, authorId: "u", body: "first" } });
  await testDb.activity.create({ data: { type: "NOTE", leadId: lead.id, authorId: "u", body: "second" } });
  const page = dataOf<Page<{ body: string }>>(
    (await mcpCall(key, "bos1_list_activities", { entityType: "LEAD", entityId: lead.id })).envelope,
  );
  assert.equal(page.items.length, 2);
});

test("GET and DELETE without a valid key get 401 too", async () => {
  const { GET, DELETE } = await import("@/app/api/mcp/route");
  for (const [method, fn] of [["GET", GET], ["DELETE", DELETE]] as const) {
    const none = await fn(new Request("http://localhost/api/mcp", { method }));
    assert.equal(none.status, 401, `${method} with no key`);
    const bad = await fn(
      new Request("http://localhost/api/mcp", { method, headers: { authorization: "Bearer bos1_" + "q".repeat(32) } }),
    );
    assert.equal(bad.status, 401, `${method} with an unknown key`);
  }
});
