import { NextResponse } from "next/server";
import {
  get,
  BlobStoreNotFoundError,
  BlobStoreSuspendedError,
  BlobAccessError,
  BlobServiceNotAvailable,
} from "@vercel/blob";
import { requireAppUserForRoute } from "@/lib/auth/app-user";
import { prisma } from "@/lib/db";
import { contentDisposition, getExtension } from "@/lib/attachments/file-policy";

const ID_RE = /^[a-z0-9]{20,40}$/;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAppUserForRoute();
  if (guard instanceof Response) return guard;
  const { id } = await params;

  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let row: { blobPathname: string; fileName: string; mimeType: string } | null;
  try {
    row = await prisma.attachment.findUnique({
      where: { id },
      select: { blobPathname: true, fileName: true, mimeType: true },
    });
  } catch (err) {
    console.error("attachments/download: lookup failed", err);
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ifNoneMatch = req.headers.get("if-none-match") ?? undefined;

  let result;
  try {
    result = await get(row.blobPathname, { access: "private", ifNoneMatch });
  } catch (err) {
    if (
      err instanceof BlobStoreNotFoundError ||
      err instanceof BlobStoreSuspendedError ||
      err instanceof BlobAccessError ||
      err instanceof BlobServiceNotAvailable
    ) {
      console.error("attachments/download: storage unavailable", err);
      return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
    }
    console.error("attachments/download: get failed", err);
    return NextResponse.json({ error: "Download failed" }, { status: 502 });
  }

  if (!result) {
    console.error("attachments/download: orphan row, blob missing", id, row.blobPathname);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (result.statusCode === 304) {
    return new Response(null, {
      status: 304,
      headers: { ETag: result.blob.etag, "Cache-Control": "private, no-cache" },
    });
  }

  return new Response(result.stream, {
    headers: {
      "Content-Type": row.mimeType,
      "Content-Disposition": contentDisposition(row.fileName, getExtension(row.fileName)),
      "X-Content-Type-Options": "nosniff",
      ETag: result.blob.etag,
      "Cache-Control": "private, no-cache",
    },
  });
}
