import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { API_KEY_LIMITS } from "@/lib/abuse-limits";
import { consumeRateLimit, type RateLimitWindow } from "@/lib/rate-limit";
import { isApiKeyScope, type ApiKeyScope } from "@/lib/auth/api-key-scopes";

/**
 * Machine access. An API key is the only credential an external agent has:
 * the raw key is shown once at creation and only its SHA-256 hash is stored.
 * Verification runs on every request against the database, never from a
 * process cache, so a revoked key stops working on every instance at once.
 */

const KEY_PREFIX = "bos1_";
const KEY_RE = /^bos1_[A-Za-z0-9_-]{32}$/;
const LAST_USED_STAMP_INTERVAL_MS = 60_000;

export type ApiKeyPrincipal = {
  kind: "apiKey";
  id: string;
  name: string;
  scopes: ApiKeyScope[];
  /** Recorded as AuditLog.actorId and Activity.authorId for this key's writes. */
  actorId: string;
};

export type ApiKeyResult =
  | { status: "ok"; principal: ApiKeyPrincipal }
  | { status: "unauthorized" }
  | { status: "rate_limited"; retryAfterSeconds: number }
  | { status: "unavailable" };

export function generateApiKey(): string {
  return KEY_PREFIX + randomBytes(24).toString("base64url");
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** "write" includes "read". */
export function hasScope(principal: { scopes: readonly ApiKeyScope[] }, scope: ApiKeyScope): boolean {
  if (principal.scopes.includes(scope)) return true;
  return scope === "read" && principal.scopes.includes("write");
}

/**
 * Resolves an Authorization header to an API key principal. Unknown, revoked,
 * expired and scopeless keys are all "unauthorized", with no detail about which.
 */
export async function resolveApiKey(
  authorizationHeader: string | null | undefined,
  limits: readonly RateLimitWindow[] = API_KEY_LIMITS,
): Promise<ApiKeyResult> {
  const match = /^Bearer\s+(\S+)$/i.exec(authorizationHeader ?? "");
  const raw = match?.[1];
  if (!raw || !KEY_RE.test(raw)) return { status: "unauthorized" };

  let row;
  try {
    row = await prisma.apiKey.findUnique({ where: { hashedKey: hashApiKey(raw) } });
  } catch (err) {
    console.error("api-key: lookup failed", err);
    return { status: "unavailable" };
  }
  if (!row || row.revokedAt) return { status: "unauthorized" };
  const now = new Date();
  if (row.expiresAt && row.expiresAt <= now) return { status: "unauthorized" };
  const scopes = row.scopes.filter(isApiKeyScope);
  if (scopes.length === 0) return { status: "unauthorized" };

  try {
    const decision = await consumeRateLimit("apikey:" + row.id, limits);
    if (!decision.allowed) {
      return { status: "rate_limited", retryAfterSeconds: decision.retryAfterSeconds };
    }
  } catch (err) {
    console.error("api-key: rate limiter failed", err);
    return { status: "unavailable" };
  }

  // Stamp at most once a minute so a busy key does not write on every request.
  try {
    await prisma.apiKey.updateMany({
      where: {
        id: row.id,
        OR: [
          { lastUsedAt: null },
          { lastUsedAt: { lt: new Date(now.getTime() - LAST_USED_STAMP_INTERVAL_MS) } },
        ],
      },
      data: { lastUsedAt: now },
    });
  } catch (err) {
    console.error("api-key: lastUsedAt stamp failed", err);
  }

  return {
    status: "ok",
    principal: { kind: "apiKey", id: row.id, name: row.name, scopes, actorId: `apikey:${row.id}` },
  };
}
