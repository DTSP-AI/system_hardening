import { test, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { testDb, resetDb, closeDb } from "../helpers/db";
import { mintApiKey } from "../helpers/mcp";
import { EXIT, parseCommand, runCli } from "../../scripts/bos1-cli-lib";

beforeEach(resetDb);
after(closeDb);

/** Sends the CLI's HTTP requests to the real MCP route handler, in-process. */
async function routeFetch(url: string, init: RequestInit): Promise<Response> {
  const { POST } = await import("@/app/api/mcp/route");
  return POST(new Request(url, init));
}

async function run(argv: string[], key: string | undefined) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runCli(argv, {
    env: { BOS1_URL: "http://localhost:3000", BOS1_API_KEY: key },
    fetch: routeFetch,
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
  });
  return { code, out: out.join("\n"), err: err.join("\n") };
}

test("parseCommand maps friendly commands to tools and arguments", () => {
  assert.deepEqual(parseCommand(["leads", "list", "--limit", "5", "--status", "NEW"]), {
    tool: "bos1_list_leads",
    args: { limit: 5, status: "NEW" },
  });
  assert.deepEqual(parseCommand(["deals", "get", "abc123"]), { tool: "bos1_get_deal", args: { id: "abc123" } });
  assert.deepEqual(parseCommand(["search", "acme", "corp"]), { tool: "bos1_search_records", args: { query: "acme corp" } });
  assert.deepEqual(parseCommand(["stages"]), { tool: "bos1_list_pipeline_stages", args: {} });
  assert.deepEqual(parseCommand(["call", "bos1_get_lead", '{"id":"x"}']), { tool: "bos1_get_lead", args: { id: "x" } });
  assert.deepEqual(parseCommand(["tools"]), { tool: null, args: {} });
});

test("parseCommand refuses an unknown command", () => {
  assert.throws(() => parseCommand(["frobnicate"]), /Unknown command/);
  assert.throws(() => parseCommand(["leads", "explode"]), /Unknown command/);
  assert.throws(() => parseCommand(["call", "bos1_get_lead", "{not json"]), /not valid JSON/);
});

test("leads list prints the page as JSON and exits 0", async () => {
  const { key } = await mintApiKey(["read"]);
  await testDb.lead.create({ data: { firstName: "Ada", lastName: "Lovelace" } });
  const { code, out } = await run(["leads", "list", "--json"], key);
  assert.equal(code, EXIT.ok);
  const page = JSON.parse(out) as { items: Array<{ firstName: string }>; nextCursor: string | null };
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].firstName, "Ada");
});

test("tools lists the tool names", async () => {
  const { key } = await mintApiKey(["read"]);
  const { code, out } = await run(["tools"], key);
  assert.equal(code, EXIT.ok);
  const tools = JSON.parse(out) as string[];
  assert.ok(tools.includes("bos1_list_leads"));
  assert.ok(tools.includes("bos1_convert_lead"));
});

test("a bad key exits with the auth code and prints no data", async () => {
  const { code, out, err } = await run(["leads", "list"], "bos1_" + "z".repeat(32));
  assert.equal(code, EXIT.auth);
  assert.equal(out, "");
  assert.match(err, /401/);
});

test("a missing key or URL exits with the auth code before any request", async () => {
  const { code, err } = await run(["leads", "list"], undefined);
  assert.equal(code, EXIT.auth);
  assert.match(err, /BOS1_API_KEY/);
});

test("a tool error exits 1 and prints the error envelope", async () => {
  const { key } = await mintApiKey(["read"]);
  const { code, out, err } = await run(["leads", "get", "does-not-exist"], key);
  assert.equal(code, EXIT.toolError);
  assert.equal(out, "");
  assert.equal((JSON.parse(err) as { code: string }).code, "not_found");
});

test("a write through the CLI with a read-only key is refused with exit 1", async () => {
  const { key } = await mintApiKey(["read"]);
  const { code, err } = await run(
    ["call", "bos1_create_lead", '{"idempotencyKey":"cli-lead-0001","firstName":"A","lastName":"B"}'],
    key,
  );
  assert.equal(code, EXIT.toolError);
  assert.equal((JSON.parse(err) as { code: string }).code, "forbidden");
  assert.equal(await testDb.lead.count(), 0);
});
