import { TRPCError } from "@trpc/server";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { Prisma } from "@generated/prisma/client";
import { hasScope, type ApiKeyPrincipal } from "@/lib/auth/api-key";
import type { ApiKeyScope } from "@/lib/auth/api-key-scopes";

/**
 * The dtsp-v1 response envelope and the per-tool scope check for the MCP
 * route. Tools never throw to the transport: guarded() turns every error into
 * a contract error, and internal details are logged, never returned.
 */

export const SCOPE_READ = "bos1:read";
export const SCOPE_WRITE = "bos1:write";

export type ErrorCode = "forbidden" | "not_found" | "validation_error" | "conflict" | "internal";

export type ToolExtra = { http?: { authInfo?: AuthInfo } };

/** JSON text for a tool result. Money columns (Prisma Decimal, 12,2) go out as numbers, not strings. */
function serialize(value: unknown): string {
  return JSON.stringify(
    value,
    function (this: Record<string, unknown>, key: string, json: unknown) {
      const raw = this[key];
      return raw instanceof Prisma.Decimal ? raw.toNumber() : json;
    },
    2,
  );
}

export function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: serialize({ success: true, data }) }] };
}

export function fail(code: ErrorCode, message: string, suggestion: string) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ success: false, error: { code, message, suggestion } }, null, 2),
      },
    ],
  };
}

/** The API key behind this request, placed on the auth info by the route's verifyToken. */
export function principalOf(extra: ToolExtra): ApiKeyPrincipal | null {
  const principal = extra.http?.authInfo?.extra?.principal;
  return principal && typeof principal === "object" ? (principal as ApiKeyPrincipal) : null;
}

/**
 * Per-tool scope gate. The framework only checks that a valid key is present;
 * every tool calls this first and returns its result when it is not null.
 */
export function requireScope(extra: ToolExtra, scope: ApiKeyScope) {
  const principal = principalOf(extra);
  if (!principal) {
    return { principal: null, denied: fail("forbidden", "No API key on this request", "Send a valid key as a Bearer token.") };
  }
  if (!hasScope(principal, scope)) {
    return {
      principal: null,
      denied: fail(
        "forbidden",
        `This key does not have the ${scope} permission`,
        "Ask an admin to create a key with that permission.",
      ),
    };
  }
  return { principal, denied: null };
}

const TRPC_TO_ENVELOPE: Partial<Record<TRPCError["code"], ErrorCode>> = {
  NOT_FOUND: "not_found",
  CONFLICT: "conflict",
  FORBIDDEN: "forbidden",
  BAD_REQUEST: "validation_error",
  PRECONDITION_FAILED: "validation_error",
};

const SUGGESTION: Record<ErrorCode, string> = {
  not_found: "List or search to find a valid id.",
  conflict: "Read the record again; its state does not allow this change.",
  forbidden: "Use a key with the required permission.",
  validation_error: "Check the arguments against the tool's parameters.",
  internal: "Retry; if it persists, report it to the workspace admin.",
};

export async function guarded(fn: () => Promise<ReturnType<typeof ok>>) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof TRPCError) {
      const code = TRPC_TO_ENVELOPE[err.code];
      if (code) return fail(code, err.message, SUGGESTION[code]);
    }
    console.error("[mcp] tool error:", err);
    return fail("internal", "The request could not be completed", SUGGESTION.internal);
  }
}
