/**
 * The BOS1 command line client. A thin HTTP client over the MCP endpoint
 * (/api/mcp): it never opens the database, so an operator or an agent needs
 * only a URL and an API key. Everything it can do is a tool in bos1.mcp.md.
 *
 * Output is JSON on stdout. Exit codes: 0 ok, 1 the tool returned an error,
 * 2 authentication, configuration or transport failure.
 */

export const EXIT = { ok: 0, toolError: 1, auth: 2 } as const;

export const USAGE = `Usage: npm run cli -- <command>

  tools                                   List the available tools
  search <text>                           Search contacts, companies, deals and leads
  leads|deals|contacts|companies|accounts list [--limit N] [--cursor ID] [--status S]
  leads|deals|contacts|companies|accounts get <id>
  stages                                  List the pipeline stages
  activities <CONTACT|DEAL|LEAD|ACCOUNT> <id> [--limit N] [--cursor ID]
  call <tool> ['<json arguments>']        Call any tool by name (writes need idempotencyKey)

Environment: BOS1_URL (e.g. https://crm.example.com), BOS1_API_KEY (bos1_...).
Output is JSON. Exit code 0 ok, 1 tool error, 2 auth or connection error.`;

const RESOURCES = {
  leads: "lead",
  deals: "deal",
  contacts: "contact",
  companies: "company",
  accounts: "account",
} as const;

const PLURAL = { lead: "leads", deal: "deals", contact: "contacts", company: "companies", account: "accounts" } as const;

export type Command = { tool: string | null; args: Record<string, unknown> };

/** Reads `--name value` pairs. `--json` is accepted and ignored: output is always JSON. */
function readFlags(tokens: string[]): Record<string, unknown> {
  const flags: Record<string, unknown> = {};
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === "--json") continue;
    if (!token.startsWith("--")) throw new Error(`Unknown command: unexpected "${token}"`);
    const name = token.slice(2);
    const value = tokens[i + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`Missing value for ${token}`);
    flags[name] = name === "limit" ? Number(value) : value;
    i += 1;
  }
  return flags;
}

/** Maps command-line words to a tool name and its arguments. `tool: null` means "list the tools". */
export function parseCommand(argv: string[]): Command {
  const [head, ...rest] = argv.filter((a) => a !== "--json" || argv[0] !== "call");
  if (!head) throw new Error("Unknown command: none given");

  if (head === "tools") return { tool: null, args: {} };
  if (head === "stages") return { tool: "bos1_list_pipeline_stages", args: {} };

  if (head === "search") {
    const words = rest.filter((w) => w !== "--json");
    if (words.length === 0) throw new Error("Unknown command: search needs text");
    return { tool: "bos1_search_records", args: { query: words.join(" ") } };
  }

  if (head === "activities") {
    const [entityType, entityId, ...flags] = rest;
    if (!entityType || !entityId) throw new Error("Unknown command: activities needs a record type and an id");
    return {
      tool: "bos1_list_activities",
      args: { entityType: entityType.toUpperCase(), entityId, ...readFlags(flags) },
    };
  }

  if (head === "call") {
    const [tool, json] = rest;
    if (!tool) throw new Error("Unknown command: call needs a tool name");
    if (json === undefined) return { tool, args: {} };
    try {
      const parsed: unknown = JSON.parse(json);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
      return { tool, args: parsed as Record<string, unknown> };
    } catch {
      throw new Error("Arguments are not valid JSON (expected an object)");
    }
  }

  if (head in RESOURCES) {
    const noun = RESOURCES[head as keyof typeof RESOURCES];
    const [verb, ...tail] = rest;
    if (verb === "list") return { tool: `bos1_list_${PLURAL[noun]}`, args: readFlags(tail) };
    if (verb === "get") {
      const [id] = tail.filter((t) => t !== "--json");
      if (!id) throw new Error(`Unknown command: ${head} get needs an id`);
      return { tool: `bos1_get_${noun}`, args: { id } };
    }
  }

  throw new Error(`Unknown command: ${argv.join(" ")}`);
}

export type CliIo = {
  env: { BOS1_URL?: string; BOS1_API_KEY?: string };
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
};

type RpcReply = { result?: unknown; error?: { code: number; message: string } };

/** A JSON-RPC reply arrives as plain JSON or as one server-sent event. */
async function readRpc(res: Response): Promise<RpcReply> {
  const text = await res.text();
  if ((res.headers.get("content-type") ?? "").includes("text/event-stream")) {
    const data = text
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("");
    return JSON.parse(data) as RpcReply;
  }
  return JSON.parse(text) as RpcReply;
}

export async function runCli(argv: string[], io: CliIo): Promise<number> {
  if (argv.length === 0 || argv[0] === "help" || argv[0] === "--help") {
    io.stdout(USAGE);
    return EXIT.ok;
  }

  let command: Command;
  try {
    command = parseCommand(argv);
  } catch (err) {
    io.stderr((err instanceof Error ? err.message : String(err)) + "\n\n" + USAGE);
    return EXIT.auth;
  }

  const base = io.env.BOS1_URL;
  const key = io.env.BOS1_API_KEY;
  if (!base || !key) {
    io.stderr("Set BOS1_URL and BOS1_API_KEY. An admin creates keys under Admin > API Keys.");
    return EXIT.auth;
  }

  const body =
    command.tool === null
      ? { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }
      : { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: command.tool, arguments: command.args } };

  let res: Response;
  try {
    res = await io.fetch(base.replace(/\/+$/, "") + "/api/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    io.stderr("Could not reach " + base + ": " + (err instanceof Error ? err.message : String(err)));
    return EXIT.auth;
  }

  if (!res.ok) {
    const hint =
      res.status === 401
        ? "the API key is missing, unknown, revoked or expired"
        : res.status === 429
          ? "this key is over its rate limit; retry after " + (res.headers.get("retry-after") ?? "a moment") + "s"
          : "the server refused the request";
    io.stderr(`HTTP ${res.status}: ${hint}`);
    return EXIT.auth;
  }

  let rpc: RpcReply;
  try {
    rpc = await readRpc(res);
  } catch {
    io.stderr("The server reply was not valid JSON-RPC");
    return EXIT.auth;
  }
  if (!rpc.result) {
    io.stderr("Protocol error: " + (rpc.error?.message ?? "no result"));
    return EXIT.auth;
  }

  if (command.tool === null) {
    const tools = (rpc.result as { tools: Array<{ name: string }> }).tools.map((t) => t.name);
    io.stdout(JSON.stringify(tools, null, 2));
    return EXIT.ok;
  }

  const result = rpc.result as { isError?: boolean; content?: Array<{ text?: string }> };
  const text = result.content?.[0]?.text ?? "";
  let envelope: { success?: boolean; data?: unknown; error?: unknown };
  try {
    envelope = JSON.parse(text);
  } catch {
    // Arguments rejected before the tool ran: the server sends plain text.
    io.stderr(JSON.stringify({ code: "validation_error", message: text }, null, 2));
    return EXIT.toolError;
  }
  if (result.isError || envelope.success !== true) {
    io.stderr(JSON.stringify(envelope.error ?? envelope, null, 2));
    return EXIT.toolError;
  }
  io.stdout(JSON.stringify(envelope.data, null, 2));
  return EXIT.ok;
}
