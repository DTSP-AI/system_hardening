/**
 * API key scopes. Client-safe: the admin panel imports this.
 * "write" includes "read". A key with no scopes has no access.
 */
export const API_KEY_SCOPES = ["read", "write"] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export function isApiKeyScope(value: string): value is ApiKeyScope {
  return (API_KEY_SCOPES as readonly string[]).includes(value);
}
