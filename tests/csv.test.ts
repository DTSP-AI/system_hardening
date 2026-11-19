import test from "node:test";
import assert from "node:assert/strict";
import { toCsv } from "../src/lib/csv";

const cols = [{ key: "v", label: "V" }];

test("toCsv neutralizes formula-leading cells", () => {
  for (const v of ["=1+1", "+1", "-1", "@SUM(A1)", "\tx", "\rx"]) {
    const out = toCsv([{ v }], cols).split("\n")[1];
    assert.ok(out.replace(/^"/, "").startsWith("'"), `not neutralized: ${JSON.stringify(v)}`);
  }
});

test("toCsv leaves ordinary values and still quotes commas", () => {
  assert.equal(toCsv([{ v: "hello" }], cols), "V\nhello");
  assert.equal(toCsv([{ v: "a,b" }], cols), 'V\n"a,b"');
});
