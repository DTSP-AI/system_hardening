import test from "node:test";
import assert from "node:assert/strict";
import { buildOutboundDialTwiml, sayAndHangup } from "@/lib/twilio/twiml";

const ACTIVITY_ID = "cm3abcdefghij0123456789xyz".slice(0, 25);

function build(activityId = ACTIVITY_ID) {
  return buildOutboundDialTwiml({
    origin: "https://bos.example.com",
    activityId,
    to: "+18135551234",
    callerId: "+18135550000",
  });
}

function attr(xml: string, name: string): string | undefined {
  const m = xml.match(new RegExp(`\\b${name}="([^"]*)"`));
  return m ? m[1].replace(/&amp;/g, "&") : undefined;
}

test("callback URLs have exactly one query key, activityId, non-empty", () => {
  const xml = build();
  for (const name of ["statusCallback", "recordingStatusCallback"]) {
    const raw = attr(xml, name);
    assert.ok(raw, name);
    const url = new URL(raw);
    assert.deepEqual([...url.searchParams.keys()], ["activityId"]);
    assert.equal(url.searchParams.get("activityId"), ACTIVITY_ID);
    assert.ok(!raw.includes("#"));
  }
});

test("callback paths", () => {
  const xml = build();
  assert.equal(new URL(attr(xml, "statusCallback")!).pathname, "/api/twilio/voice/status");
  assert.equal(
    new URL(attr(xml, "recordingStatusCallback")!).pathname,
    "/api/twilio/voice/recording",
  );
});

test("announce URL has no query string", () => {
  const xml = build();
  const url = new URL(attr(xml, "url")!);
  assert.equal(url.pathname, "/api/twilio/voice/announce");
  assert.equal(url.search, "");
});

test("timeLimit, callerId, record and disclosure are present", () => {
  const xml = build();
  assert.equal(attr(xml, "timeLimit"), "1800");
  assert.equal(attr(xml, "callerId"), "+18135550000");
  assert.equal(attr(xml, "record"), "record-from-answer");
  assert.ok(xml.includes("This call may be recorded for quality and training purposes."));
  assert.ok(xml.includes("+18135551234"));
});

test("throws on empty or malformed activityId (Law 2)", () => {
  for (const bad of ["", "short", "UPPERCASEUPPERCASEUPPERCASE", "has-dash-aaaaaaaaaaaaaaaaaaaa", "a".repeat(41)]) {
    assert.throws(() => build(bad), bad);
  }
});

test("sayAndHangup emits Say then Hangup", () => {
  const xml = sayAndHangup("Nope.");
  assert.ok(xml.indexOf("<Say>Nope.</Say>") !== -1);
  assert.ok(xml.indexOf("<Hangup/>") > xml.indexOf("<Say>"));
});
