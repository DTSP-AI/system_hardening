/**
 * Calls the real MCP route handler in-process, the way a remote client would:
 * a JSON-RPC POST with a bearer key. No HTTP server is started.
 */
import "./db";
import { testDb } from "./db";
import { generateApiKey, hashApiKey } from "@/lib/auth/api-key";
import type { ApiKeyScope } from "@/lib/auth/api-key-scopes";

export type Envelope =
  | { success: true; data: unknown }
  | { success: false; error: { code: string; message: string; suggestion?: string } };

export async function mintApiKey(scopes: ApiKeyScope[], name = "test agent") {
  const key = generateApiKey();
  const row = await testDb.apiKey.create({
    data: { name, hashedKey: hashApiKey(key), scopes, createdByUserId: "test" },
  });
  return { id: row.id, key, actorId: `apikey:${row.id}` };
}

let rpcId = 0;

async function post(body: unknown, key?: string | null): Promise<Response> {
  const { POST } = await import("@/app/api/mcp/route");
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };
  if (key) headers.authorization = `Bearer ${key}`;
  return POST(new Request("http://localhost/api/mcp", { method: "POST", headers, body: JSON.stringify(body) }));
}

/** Parses a JSON-RPC reply sent either as plain JSON or as a single SSE message. */
async function readRpc(res: Response): Promise<{ result?: unknown; error?: { code: number; message: string } }> {
  const text = await res.text();
  const type = res.headers.get("content-type") ?? "";
  if (type.includes("text/event-stream")) {
    const data = text
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("");
    return JSON.parse(data);
  }
  return JSON.parse(text);
}

export async function mcpRaw(method: string, params: unknown, key?: string | null) {
  rpcId += 1;
  const res = await post({ jsonrpc: "2.0", id: rpcId, method, params }, key);
  return res;
}

export async function mcpListTools(key: string): Promise<string[]> {
  const res = await mcpRaw("tools/list", {}, key);
  const rpc = await readRpc(res);
  const tools = (rpc.result as { tools: Array<{ name: string }> }).tools;
  return tools.map((t) => t.name);
}

/** Calls a tool and returns the dtsp-v1 envelope plus the MCP isError flag. */
export async function mcpCall(
  key: string,
  name: string,
  args: Record<string, unknown> = {},
): Promise<{ status: number; isError: boolean; envelope: Envelope }> {
  const res = await mcpRaw("tools/call", { name, arguments: args }, key);
  const rpc = await readRpc(res);
  if (!rpc.result) {
    throw new Error(`MCP transport error for ${name}: ${JSON.stringify(rpc.error ?? rpc)}`);
  }
  const result = rpc.result as { isError?: boolean; content: Array<{ type: string; text: string }> };
  const text = result.content[0]?.text ?? "";
  let envelope: Envelope;
  try {
    envelope = JSON.parse(text);
  } catch {
    // The SDK rejects invalid arguments itself, before the tool runs, with a plain-text error.
    envelope = { success: false, error: { code: "validation_error", message: text } };
  }
  return { status: res.status, isError: result.isError === true, envelope };
}

export function dataOf<T>(envelope: Envelope): T {
  if (!envelope.success) throw new Error(`expected success, got ${JSON.stringify(envelope.error)}`);
  return envelope.data as T;
}
