import test from "node:test";
import assert from "node:assert/strict";
import { MAX_UPLOAD_BYTES } from "@/lib/abuse-limits";
import {
  ALLOWED,
  ATTACHMENT_PATH_RE,
  contentDisposition,
  sanitizeFileName,
  validateUpload,
} from "@/lib/attachments/file-policy";

const bytes = (...b: number[]) => new Uint8Array(b);
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00);
const JPG = bytes(0xff, 0xd8, 0xff, 0xe0);
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04, 0x14);
const TEXT = new TextEncoder().encode("a,b\n1,2\n");
const BAD = bytes(0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08);

const good: Array<[string, Uint8Array, boolean]> = [
  ["a.pdf", PDF, false],
  ["a.png", PNG, false],
  ["a.jpg", JPG, false],
  ["a.jpeg", JPG, false],
  ["a.docx", ZIP, false],
  ["a.xlsx", ZIP, false],
  ["a.csv", TEXT, true],
  ["a.txt", TEXT, true],
];

test("every allowed type validates with the extension's canonical type", () => {
  for (const [name, data, text] of good) {
    const r = validateUpload({
      name,
      size: data.length,
      head: data.slice(0, 8),
      full: text ? data : undefined,
    });
    assert.equal(r.ok, true, name);
    if (r.ok) {
      const ext = name.split(".")[1] as keyof typeof ALLOWED;
      assert.equal(r.contentType, ALLOWED[ext].contentType);
      assert.equal(r.ext, ext);
    }
  }
});

test("mismatched magic is 415 for each magic type", () => {
  for (const [name] of good.filter((g) => !g[2])) {
    const r = validateUpload({ name, size: 8, head: BAD });
    assert.deepEqual(r, { ok: false, status: 415, error: "File content does not match its type" }, name);
  }
});

test("text types with a NUL byte are 415", () => {
  const data = bytes(0x61, 0x00, 0x62);
  for (const name of ["a.csv", "a.txt"]) {
    const r = validateUpload({ name, size: 3, head: data, full: data });
    assert.equal(r.ok === false && r.status, 415, name);
  }
});

test("Windows-1252 text is accepted (no strict UTF-8)", () => {
  const data = bytes(0x63, 0x61, 0x66, 0xe9, 0x0a);
  assert.equal(validateUpload({ name: "a.csv", size: 5, head: data, full: data }).ok, true);
});

test("text types without full content fail closed", () => {
  const r = validateUpload({ name: "a.txt", size: 3, head: TEXT });
  assert.equal(r.ok, false);
});

test("empty file is 400", () => {
  const r = validateUpload({ name: "a.pdf", size: 0, head: new Uint8Array() });
  assert.equal(r.ok === false && r.status, 400);
});

test("size boundary: exactly 4 MiB passes, 4 MiB + 1 is 413", () => {
  assert.equal(MAX_UPLOAD_BYTES, 4 * 1024 * 1024);
  assert.equal(validateUpload({ name: "a.pdf", size: MAX_UPLOAD_BYTES, head: PDF }).ok, true);
  const r = validateUpload({ name: "a.pdf", size: MAX_UPLOAD_BYTES + 1, head: PDF });
  assert.equal(r.ok === false && r.status, 413);
});

test("disallowed or missing extension is 415", () => {
  for (const name of ["a.exe", "a.html", "a.svg", "noext", "a.pdf.exe"]) {
    const r = validateUpload({ name, size: 8, head: PDF });
    assert.equal(r.ok === false && r.status, 415, name);
  }
});

test("extension match is case-insensitive", () => {
  assert.equal(validateUpload({ name: "A.PDF", size: 6, head: PDF }).ok, true);
});

test("sanitizeFileName", () => {
  assert.equal(sanitizeFileName("../../etc/passwd"), "passwd");
  assert.equal(sanitizeFileName("C:\\x\\y\\report.pdf"), "report.pdf");
  assert.equal(sanitizeFileName("a\u0000b\u001fc.txt"), "abc.txt");
  assert.equal(sanitizeFileName("  spaced.txt  "), "spaced.txt");
  assert.equal(sanitizeFileName("   "), null);
  assert.equal(sanitizeFileName("a/"), null);
  const long = sanitizeFileName("x".repeat(500) + ".pdf");
  assert.ok(long && long.length <= 200);
});

test("contentDisposition", () => {
  assert.equal(
    contentDisposition("report.pdf", "pdf"),
    `inline; filename="report.pdf"; filename*=UTF-8''report.pdf`,
  );
  assert.ok(contentDisposition("a.png", "png").startsWith("inline;"));
  assert.ok(contentDisposition("a.jpeg", "jpeg").startsWith("inline;"));
  for (const ext of ["docx", "xlsx", "csv", "txt"]) {
    assert.ok(contentDisposition(`a.${ext}`, ext).startsWith("attachment;"), ext);
  }
  const d = contentDisposition('caf\u00e9 "q" \\.pdf', "pdf");
  assert.ok(d.includes(`filename="caf_ _q_ __.pdf"`) || d.includes(`filename="caf_ _q_ _.pdf"`), d);
  assert.ok(d.includes("filename*=UTF-8''caf%C3%A9%20%22q%22%20%5C.pdf"), d);
});

test("ATTACHMENT_PATH_RE", () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";
  assert.ok(ATTACHMENT_PATH_RE.test(`attachments/contact/abc123/${id}.pdf`));
  assert.ok(ATTACHMENT_PATH_RE.test(`attachments/deal/abc_-1/${id}.jpeg`));
  assert.ok(!ATTACHMENT_PATH_RE.test(`attachments/user/abc/${id}.pdf`));
  assert.ok(!ATTACHMENT_PATH_RE.test(`attachments/contact/abc/${id}.exe`));
  assert.ok(!ATTACHMENT_PATH_RE.test(`attachments/contact/a/b/${id}.pdf`));
  assert.ok(!ATTACHMENT_PATH_RE.test(`attachments/contact/../${id}.pdf`));
  assert.ok(!ATTACHMENT_PATH_RE.test(`/attachments/contact/abc/${id}.pdf`));
  assert.ok(!ATTACHMENT_PATH_RE.test(`attachments/contact/abc/short.pdf`));
  assert.ok(!ATTACHMENT_PATH_RE.test(`attachments/contact/${"a".repeat(65)}/${id}.pdf`));
});

test("every attachable entity type has an accepted attachment path", async () => {
  const { ENTITY_TYPES } = await import("@/lib/entity-types");
  const { attachmentPathPrefix } = await import("@/lib/attachments/file-policy");
  assert.ok(ENTITY_TYPES.includes("ACCOUNT"));
  for (const type of ENTITY_TYPES) {
    const path = attachmentPathPrefix(type, "cmabc123def456ghi789jkl0") + "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e.pdf";
    assert.match(path, ATTACHMENT_PATH_RE, `${type} attachment path must be accepted`);
  }
});

test("an account attachment path is accepted and an unknown entity type is refused", () => {
  assert.match(
    "attachments/account/cmabc123def456ghi789jkl0/0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e.pdf",
    ATTACHMENT_PATH_RE,
  );
  assert.doesNotMatch(
    "attachments/invoice/cmabc123def456ghi789jkl0/0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e.pdf",
    ATTACHMENT_PATH_RE,
  );
});

test("the attachment path requires a literal dot before the extension", () => {
  assert.doesNotMatch(
    "attachments/deal/cmabc123def456ghi789jkl0/0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4eXpdf",
    ATTACHMENT_PATH_RE,
  );
});
