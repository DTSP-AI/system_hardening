import { NextResponse } from "next/server";
import { z } from "zod";
import {
  put,
  BlobFileTooLargeError,
  BlobServiceRateLimited,
  BlobStoreNotFoundError,
  BlobStoreSuspendedError,
  BlobAccessError,
  BlobServiceNotAvailable,
} from "@vercel/blob";
import { requireAppUserForRoute } from "@/lib/auth/app-user";
import { prisma } from "@/lib/db";
import { MAX_UPLOAD_BYTES, UPLOAD_LIMITS } from "@/lib/abuse-limits";
import { consumeRateLimit } from "@/lib/rate-limit";
import { attachmentPathPrefix, validateUpload } from "@/lib/attachments/file-policy";
import { ENTITY_TYPES } from "@/lib/entity-types";
import { entityExists } from "@/lib/attachments/entity";

const fieldsSchema = z.object({
  entityType: z.enum(ENTITY_TYPES),
  entityId: z.string().min(1).max(64),
});

export async function POST(req: Request) {
  const guard = await requireAppUserForRoute();
  if (guard instanceof Response) return guard;
  const { user } = guard;

  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) {
    return NextResponse.json({ error: "Uploads are not configured" }, { status: 503 });
  }

  const contentLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES + 65_536) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const fields = fieldsSchema.safeParse({
    entityType: formData.get("entityType"),
    entityId: formData.get("entityId"),
  });
  if (!fields.success) {
    return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
  }
  const { entityType, entityId } = fields.data;

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const lower = file.name.toLowerCase();
  const needsFull = lower.endsWith(".csv") || lower.endsWith(".txt");
  const full = needsFull ? new Uint8Array(await file.arrayBuffer()) : undefined;

  const v = validateUpload({ name: file.name, size: file.size, head, full });
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: v.status });
  }

  let exists: boolean;
  try {
    exists = await entityExists(prisma, entityType, entityId);
  } catch (err) {
    console.error("attachments/upload: entity lookup failed", err);
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
  if (!exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let decision;
  try {
    decision = await consumeRateLimit("upload:" + user.id, UPLOAD_LIMITS);
  } catch (err) {
    console.error("attachments/upload: rate limit failed", err);
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
  if (!decision.allowed) {
    return NextResponse.json(
      { error: "Too many uploads. Try again later." },
      { status: 429, headers: { "Retry-After": String(decision.retryAfterSeconds) } },
    );
  }

  const key =
    attachmentPathPrefix(entityType, entityId) + crypto.randomUUID() + "." + v.ext;

  try {
    const blob = await put(key, file, {
      access: "private",
      contentType: v.contentType,
      addRandomSuffix: false,
    });
    return NextResponse.json({
      pathname: blob.pathname,
      name: v.fileName,
      size: file.size,
      contentType: v.contentType,
    });
  } catch (err) {
    if (err instanceof BlobFileTooLargeError) {
      return NextResponse.json({ error: "File too large" }, { status: 413 });
    }
    if (err instanceof BlobServiceRateLimited) {
      return NextResponse.json({ error: "Storage is busy. Try again later." }, { status: 429 });
    }
    if (
      err instanceof BlobStoreNotFoundError ||
      err instanceof BlobStoreSuspendedError ||
      err instanceof BlobAccessError ||
      err instanceof BlobServiceNotAvailable
    ) {
      console.error("attachments/upload: storage unavailable", err);
      return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
    }
    console.error("attachments/upload: put failed", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 502 });
  }
}
