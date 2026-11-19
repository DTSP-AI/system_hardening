// BOS1 MCP server: the agent-facing door to the CRM.
//
// CONTRACT: bos1.mcp.md at the repo root is the source of truth. Change the
// contract, then this file. scripts in the MCP skill check the two agree.
//
// Transport: Streamable HTTP at /api/mcp (mcp-handler v2).
// Auth: a BOS1 API key as a Bearer token, verified on every request against
// the api_keys table (src/lib/auth/api-key.ts). There is no Clerk session
// here, which is why src/proxy.ts lists this path as public.
//
// Tools are thin wrappers over src/server/services/. No business rule lives in
// this file, and no tool calls Prisma directly.

import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveApiKey, type ApiKeyPrincipal } from "@/lib/auth/api-key";
import { SCOPE_READ, SCOPE_WRITE, guarded, ok, requireScope } from "@/server/mcp/envelope";
import {
  ACTIVITY_PARENT_TYPES,
  MAX_PAGE_SIZE,
  getAccount,
  getCompany,
  getContact,
  getDeal,
  getLead,
  listAccounts,
  listActivities,
  listCompanies,
  listContacts,
  listDeals,
  listLeads,
  listPipelineStages,
  searchRecords,
} from "@/server/services/crm-read";

export const maxDuration = 60;

const zId = z.string().min(1).max(64);
const page = {
  limit: z.number().int().min(1).max(MAX_PAGE_SIZE).optional().describe("Rows per page, 1-100. Default 25."),
  cursor: zId.optional().describe("nextCursor from the previous page."),
};

const handler = createMcpHandler(
  (server) => {
    // ── Read tools (scope bos1:read) ─────────────────────────────────
    server.registerTool(
      "bos1_search_records",
      {
        description:
          "Search contacts, companies, deals and leads by name (and contact email). Returns up to five matches per type.",
        inputSchema: z.object({ query: z.string().min(1).max(100) }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async ({ query }, extra) => {
        const gate = requireScope(extra, "read");
        if (gate.denied) return gate.denied;
        return guarded(async () => ok(await searchRecords(prisma, query)));
      },
    );

    server.registerTool(
      "bos1_list_leads",
      {
        description: "List leads, newest first, one page at a time. Optionally filter by status.",
        inputSchema: z.object({
          ...page,
          status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "UNQUALIFIED", "CONVERTED"]).optional(),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async (args, extra) => {
        const gate = requireScope(extra, "read");
        if (gate.denied) return gate.denied;
        return guarded(async () => ok(await listLeads(prisma, args)));
      },
    );

    server.registerTool(
      "bos1_get_lead",
      {
        description: "Fetch one lead by id.",
        inputSchema: z.object({ id: zId }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async ({ id }, extra) => {
        const gate = requireScope(extra, "read");
        if (gate.denied) return gate.denied;
        return guarded(async () => ok(await getLead(prisma, id)));
      },
    );

    server.registerTool(
      "bos1_list_deals",
      {
        description:
          "List deals, newest first, one page at a time, each with its pipeline stage. Optionally filter by status or stage.",
        inputSchema: z.object({
          ...page,
          status: z.enum(["OPEN", "WON", "LOST"]).optional(),
          stageId: zId.optional(),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async (args, extra) => {
        const gate = requireScope(extra, "read");
        if (gate.denied) return gate.denied;
        return guarded(async () => ok(await listDeals(prisma, args)));
      },
    );

    server.registerTool(
      "bos1_get_deal",
      {
        description: "Fetch one deal by id with its stage, contact, company and account link.",
        inputSchema: z.object({ id: zId }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async ({ id }, extra) => {
        const gate = requireScope(extra, "read");
        if (gate.denied) return gate.denied;
        return guarded(async () => ok(await getDeal(prisma, id)));
      },
    );

    server.registerTool(
      "bos1_list_contacts",
      {
        description: "List contacts, newest first, one page at a time. Optionally filter by company.",
        inputSchema: z.object({ ...page, companyId: zId.optional() }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async (args, extra) => {
        const gate = requireScope(extra, "read");
        if (gate.denied) return gate.denied;
        return guarded(async () => ok(await listContacts(prisma, args)));
      },
    );

    server.registerTool(
      "bos1_get_contact",
      {
        description: "Fetch one contact by id with its company.",
        inputSchema: z.object({ id: zId }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async ({ id }, extra) => {
        const gate = requireScope(extra, "read");
        if (gate.denied) return gate.denied;
        return guarded(async () => ok(await getContact(prisma, id)));
      },
    );

    server.registerTool(
      "bos1_list_companies",
      {
        description: "List companies, newest first, one page at a time.",
        inputSchema: z.object({ ...page }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async (args, extra) => {
        const gate = requireScope(extra, "read");
        if (gate.denied) return gate.denied;
        return guarded(async () => ok(await listCompanies(prisma, args)));
      },
    );

    server.registerTool(
      "bos1_get_company",
      {
        description: "Fetch one company by id.",
        inputSchema: z.object({ id: zId }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async ({ id }, extra) => {
        const gate = requireScope(extra, "read");
        if (gate.denied) return gate.denied;
        return guarded(async () => ok(await getCompany(prisma, id)));
      },
    );

    server.registerTool(
      "bos1_list_accounts",
      {
        description: "List accounts (won deals that became customers), newest first, one page at a time.",
        inputSchema: z.object({ ...page, status: z.enum(["ACTIVE", "CHURNED"]).optional() }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async (args, extra) => {
        const gate = requireScope(extra, "read");
        if (gate.denied) return gate.denied;
        return guarded(async () => ok(await listAccounts(prisma, args)));
      },
    );

    server.registerTool(
      "bos1_get_account",
      {
        description: "Fetch one account by id with its company, contact and source deal.",
        inputSchema: z.object({ id: zId }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async ({ id }, extra) => {
        const gate = requireScope(extra, "read");
        if (gate.denied) return gate.denied;
        return guarded(async () => ok(await getAccount(prisma, id)));
      },
    );

    server.registerTool(
      "bos1_list_pipeline_stages",
      {
        description:
          "List the deal pipeline stages in order. Each says whether it is a Won or Lost stage; use a stage id with bos1_move_deal_stage.",
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async (_args, extra) => {
        const gate = requireScope(extra, "read");
        if (gate.denied) return gate.denied;
        return guarded(async () => ok({ items: await listPipelineStages(prisma) }));
      },
    );

    server.registerTool(
      "bos1_list_activities",
      {
        description:
          "List the activity timeline (notes, tasks, calls, emails, meetings) of one contact, deal, lead or account, newest first.",
        inputSchema: z.object({ ...page, entityType: z.enum(ACTIVITY_PARENT_TYPES), entityId: zId }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async (args, extra) => {
        const gate = requireScope(extra, "read");
        if (gate.denied) return gate.denied;
        return guarded(async () => ok(await listActivities(prisma, args)));
      },
    );
  },
  { serverInfo: { name: "bos1-crm", version: "1.0.0" } },
);

// A request's key is resolved once, here, and reused by verifyToken below, so
// a rate-limited or unavailable check can answer 429 or 503 instead of 401.
const resolved = new WeakMap<Request, ApiKeyPrincipal>();

function toAuthInfo(token: string, principal: ApiKeyPrincipal): AuthInfo {
  const scopes = principal.scopes.includes("write") ? [SCOPE_READ, SCOPE_WRITE] : [SCOPE_READ];
  return { token, clientId: principal.id, scopes, extra: { principal } };
}

const verifyToken = async (req: Request, bearerToken?: string): Promise<AuthInfo | undefined> => {
  if (!bearerToken) return undefined;
  const known = resolved.get(req);
  if (known) return toAuthInfo(bearerToken, known);
  const result = await resolveApiKey(`Bearer ${bearerToken}`);
  return result.status === "ok" ? toAuthInfo(bearerToken, result.principal) : undefined;
};

const authed = withMcpAuth(handler, verifyToken, { required: true });

async function route(req: Request): Promise<Response> {
  const result = await resolveApiKey(req.headers.get("authorization"));
  if (result.status === "rate_limited") {
    return Response.json(
      { error: "Too many requests for this key" },
      { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
    );
  }
  if (result.status === "unavailable") {
    return Response.json({ error: "Key verification unavailable" }, { status: 503 });
  }
  if (result.status === "unauthorized") {
    return Response.json(
      { error: "A valid BOS1 API key is required" },
      { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="bos1"' } },
    );
  }
  resolved.set(req, result.principal);
  return authed(req);
}

export { route as GET, route as POST, route as DELETE };
