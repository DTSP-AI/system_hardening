import test from "node:test";
import assert from "node:assert/strict";
import { computeRetryAfterSeconds, largestWindowMs } from "@/lib/rate-limit";

test("largestWindowMs picks the biggest window", () => {
  assert.equal(
    largestWindowMs([
      { windowMs: 3_600_000, max: 30 },
      { windowMs: 86_400_000, max: 200 },
    ]),
    86_400_000,
  );
  assert.equal(largestWindowMs([]), 0);
});

test("computeRetryAfterSeconds rounds up", () => {
  assert.equal(computeRetryAfterSeconds(1_000, 10_000, 5_000), 6);
  assert.equal(computeRetryAfterSeconds(1_000, 10_000, 5_500), 6);
  assert.equal(computeRetryAfterSeconds(1_000, 10_000, 5_001), 6);
});

test("computeRetryAfterSeconds is at least 1", () => {
  assert.equal(computeRetryAfterSeconds(0, 1_000, 5_000), 1);
  assert.equal(computeRetryAfterSeconds(0, 1_000, 1_000), 1);
});
