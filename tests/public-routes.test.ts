import { test } from "node:test";
import assert from "node:assert/strict";
import { PUBLIC_ROUTE_PATTERNS } from "@/lib/auth/public-routes";

test("the MCP endpoint and the Twilio callbacks bypass the browser-session check", () => {
  const routes: readonly string[] = PUBLIC_ROUTE_PATTERNS;
  for (const path of [
    "/api/mcp",
    "/api/twilio/voice",
    "/api/twilio/voice/status",
    "/api/twilio/voice/recording",
    "/api/twilio/voice/announce",
  ]) {
    assert.ok(routes.includes(path), `${path} must be public to the Clerk middleware`);
  }
});

test("no app or tRPC path is public", () => {
  for (const pattern of PUBLIC_ROUTE_PATTERNS) {
    assert.equal(pattern.startsWith("/api/trpc"), false);
    assert.equal(pattern.startsWith("/api/attachments"), false);
    assert.notEqual(pattern, "/(.*)");
  }
});
