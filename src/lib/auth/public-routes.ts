/**
 * Paths the Clerk middleware (src/proxy.ts) lets through without a browser
 * session. Each one authenticates another way; nothing here is unauthenticated.
 */
export const PUBLIC_ROUTE_PATTERNS = [
  "/sign-in(.*)",
  "/sign-up(.*)",
  // Twilio's own server-to-server callbacks -- no Clerk session present,
  // authenticated instead via X-Twilio-Signature (readValidatedTwilioForm).
  "/api/twilio/voice",
  "/api/twilio/voice/status",
  "/api/twilio/voice/recording",
  "/api/twilio/voice/announce",
  // MCP endpoint for external agents -- authenticated by a BOS1 API key
  // (Bearer token) on every request, see src/lib/auth/api-key.ts.
  "/api/mcp",
] as const;
