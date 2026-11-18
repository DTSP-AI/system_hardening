import { MAX_UPLOAD_BYTES } from "@/lib/abuse-limits";

type Check = { kind: "magic"; bytes: readonly number[] } | { kind: "text" };

const ZIP: Check = { kind: "magic", bytes: [0x50, 0x4b, 0x03, 0x04] };

/**
 * Extension -> canonical content type + content check. The client-supplied
 * File.type is never used (Windows reports CSV as application/vnd.ms-excel).
 * docx/xlsx are verified by ZIP signature only (no zip dependency).
 */
export const ALLOWED = {
  pdf: { contentType: "application/pdf", check: { kind: "magic", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] } as Check },
  png: { contentType: "image/png", check: { kind: "magic", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] } as Check },
  jpg: { contentType: "image/jpeg", check: { kind: "magic", bytes: [0xff, 0xd8, 0xff] } as Check },
  jpeg: { contentType: "image/jpeg", check: { kind: "magic", bytes: [0xff, 0xd8, 0xff] } as Check },
  docx: {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    check: ZIP,
  },
  xlsx: {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    check: ZIP,
  },
  csv: { contentType: "text/csv", check: { kind: "text" } as Check },
  txt: { contentType: "text/plain", check: { kind: "text" } as Check },
} as const;

export type AllowedExt = keyof typeof ALLOWED;

export const ATTACHMENT_PATH_RE =
  /^attachments\/(contact|company|deal|lead)\/[A-Za-z0-9_-]{1,64}\/[0-9a-f-]{36}\.(pdf|png|jpg|jpeg|docx|xlsx|csv|txt)$/;

export function isAllowedExt(ext: string): ext is AllowedExt {
  return Object.prototype.hasOwnProperty.call(ALLOWED, ext);
}

export function getExtension(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const i = base.lastIndexOf(".");
  return i === -1 ? "" : base.slice(i + 1).toLowerCase();
}

/** Basename only, control characters and slashes stripped, trimmed, max 200 chars. Null if empty. */
export function sanitizeFileName(name: string): string | null {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").replace(/[/\\]/g, "").trim();
  const sliced = cleaned.slice(0, 200).trim();
  return sliced.length > 0 ? sliced : null;
}

function startsWith(data: Uint8Array, bytes: readonly number[]): boolean {
  if (data.length < bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) {
    if (data[i] !== bytes[i]) return false;
  }
  return true;
}

export type UploadValidation =
  | { ok: true; ext: AllowedExt; contentType: string; fileName: string }
  | { ok: false; status: 400 | 413 | 415; error: string };

export function validateUpload(input: {
  name: string;
  size: number;
  head: Uint8Array;
  full?: Uint8Array;
}): UploadValidation {
  const { name, size, head, full } = input;

  if (size === 0) return { ok: false, status: 400, error: "File is empty" };
  if (size > MAX_UPLOAD_BYTES) return { ok: false, status: 413, error: "File too large" };

  const fileName = sanitizeFileName(name);
  if (!fileName) return { ok: false, status: 400, error: "Invalid file name" };

  const ext = getExtension(fileName);
  if (!isAllowedExt(ext)) return { ok: false, status: 415, error: "File type not allowed" };

  const { contentType, check } = ALLOWED[ext];
  if (check.kind === "magic") {
    if (!startsWith(head, check.bytes)) {
      return { ok: false, status: 415, error: "File content does not match its type" };
    }
  } else {
    // Text types need the whole file; without it the check cannot be made, so fail closed.
    if (!full) return { ok: false, status: 400, error: "Unable to verify file content" };
    if (full.includes(0x00)) {
      return { ok: false, status: 415, error: "File content does not match its type" };
    }
  }

  return { ok: true, ext, contentType, fileName };
}

const INLINE_EXTS: ReadonlySet<string> = new Set(["pdf", "png", "jpg", "jpeg"]);

export function contentDisposition(fileName: string, ext: string): string {
  const type = INLINE_EXTS.has(ext) ? "inline" : "attachment";
  const ascii = fileName.replace(/[^\x20-\x7E]|["\\]/g, "_");
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
