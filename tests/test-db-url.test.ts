import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_TEST_DATABASE_URL, assertLocalDatabaseUrl } from "./helpers/test-db-url";

test("the default test database is local", () => {
  assert.doesNotThrow(() => assertLocalDatabaseUrl(DEFAULT_TEST_DATABASE_URL));
});

test("localhost is accepted", () => {
  assert.doesNotThrow(() => assertLocalDatabaseUrl("postgresql://u:p@localhost:5432/db"));
});

test("a hosted database is refused", () => {
  assert.throws(
    () => assertLocalDatabaseUrl("postgresql://u:p@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb"),
    /non-local database host/,
  );
});

test("a malformed URL is refused", () => {
  assert.throws(() => assertLocalDatabaseUrl("not a url"), /not a valid URL/);
});
