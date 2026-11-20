import { test } from "node:test";
import assert from "node:assert/strict";
import { outcomeOfProviderError } from "@/lib/email";

// The Resend SDK (4.8.0) does not throw on a transport failure. It returns
// { error: { name: "application_error", ... } } for a failed fetch and for a
// reply it could not parse. Neither says the message was refused.

test("a failed fetch reported by the SDK is an unknown outcome", () => {
  assert.equal(
    outcomeOfProviderError({
      name: "application_error",
      message: "Unable to fetch data. The request could not be resolved.",
    }),
    "unknown",
  );
});

test("an unparseable or server-side error reply is an unknown outcome", () => {
  assert.equal(outcomeOfProviderError({ name: "application_error", message: "Internal server error." }), "unknown");
  assert.equal(outcomeOfProviderError({ name: "internal_server_error", message: "boom" }), "unknown");
});

test("a request the provider understood and refused is a rejection", () => {
  assert.equal(outcomeOfProviderError({ name: "validation_error", message: "Invalid `from` field" }), "rejected");
  assert.equal(outcomeOfProviderError({ name: "missing_required_field", message: "to" }), "rejected");
  assert.equal(outcomeOfProviderError({ name: "invalid_api_Key", message: "API key is invalid" }), "rejected");
  assert.equal(outcomeOfProviderError({ name: "rate_limit_exceeded", message: "Too many requests" }), "rejected");
});

test("an error with no recognisable name is treated as unknown, never as a rejection", () => {
  assert.equal(outcomeOfProviderError(null), "unknown");
  assert.equal(outcomeOfProviderError({}), "unknown");
  assert.equal(outcomeOfProviderError("oops"), "unknown");
});
