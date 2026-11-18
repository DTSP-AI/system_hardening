import test from "node:test";
import assert from "node:assert/strict";
import {
  BLOCKED_NANP_AREA_CODES,
  checkDialable,
  normalizeNanp,
} from "@/lib/twilio/dial-policy";

test("normalizeNanp accepts formatted, 10-digit, 11-digit and +1 input", () => {
  assert.equal(normalizeNanp("(813) 555-1234"), "+18135551234");
  assert.equal(normalizeNanp("813-555-1234"), "+18135551234");
  assert.equal(normalizeNanp("8135551234"), "+18135551234");
  assert.equal(normalizeNanp("18135551234"), "+18135551234");
  assert.equal(normalizeNanp("+18135551234"), "+18135551234");
  assert.equal(normalizeNanp("+1 (813) 555-1234"), "+18135551234");
});

test("normalizeNanp rejects non-NANP, short, and malformed input", () => {
  assert.equal(normalizeNanp("+442071838750"), null);
  assert.equal(normalizeNanp("911"), null);
  assert.equal(normalizeNanp("411"), null);
  assert.equal(normalizeNanp(""), null);
  assert.equal(normalizeNanp("abc"), null);
  assert.equal(normalizeNanp("0135551234"), null);
  assert.equal(normalizeNanp("1135551234"), null); // NPA starts with 1
  assert.equal(normalizeNanp("8131551234"), null); // NXX starts with 1
  assert.equal(normalizeNanp("+28135551234"), null);
});

test("checkDialable returns e164 for a valid number", () => {
  assert.deepEqual(checkDialable("813-555-1234"), { ok: true, e164: "+18135551234" });
});

test("checkDialable returns invalid for non-NANP", () => {
  assert.deepEqual(checkDialable("+442071838750"), { ok: false, reason: "invalid" });
  assert.deepEqual(checkDialable("911"), { ok: false, reason: "invalid" });
});

test("checkDialable blocks every blocked area code", () => {
  assert.ok(BLOCKED_NANP_AREA_CODES.size > 0);
  for (const npa of BLOCKED_NANP_AREA_CODES) {
    assert.deepEqual(
      checkDialable(`+1${npa}2345678`),
      { ok: false, reason: "blocked" },
      `area code ${npa}`,
    );
  }
});

test("checkDialable blocks exchange 976", () => {
  assert.deepEqual(checkDialable("+18139761234"), { ok: false, reason: "blocked" });
});

test("checkDialable allows a toll-free number", () => {
  assert.deepEqual(checkDialable("+18005551234"), { ok: true, e164: "+18005551234" });
});

test("checkDialable blocks US territories", () => {
  for (const npa of ["340", "670", "671", "684", "787", "939"]) {
    assert.equal(checkDialable(`+1${npa}2345678`).ok, false, npa);
  }
});
