import { TRPCError } from "@trpc/server";
import { del as blobDel, head as blobHead, BlobNotFoundError } from "@vercel/blob";
import { Prisma } from "@generated/prisma/client";
import type { Attachment, PrismaClient, UserRole } from "@generated/prisma/client";
import { MAX_UPLOAD_BYTES } from "@/lib/abuse-limits";
import { logAudit, toJsonSafe } from "@/lib/audit";
import { entityExists } from "@/lib/attachments/entity";
import {
  ALLOWED,
  attachmentPathPrefix,
  getExtension,
  isAllowedExt,
  sanitizeFileName,
} from "@/lib/attachments/file-policy";
import type { EntityType } from "@/lib/entity-types";

/**
 * Attachment records. Storage calls (Vercel Blob) are never made inside a
 * database transaction: lookups run before one opens and deletes after it
 * commits. `db` must be the bare client; these functions open their own
 * short transaction around the row and its audit entry.
 */

export type AttachmentCreateDeps = { head: (pathname: string) => Promise<{ size: number }> };
export type AttachmentDeleteDeps = { del: (pathname: string) => Promise<void> };

export async function createAttachment(
  db: PrismaClient,
  params: { actorId: string; entityType: EntityType; entityId: string; fileName: string; blobPathname: string },
  deps: AttachmentCreateDeps = { head: blobHead },
): Promise<Attachment> {
  if (!params.blobPathname.startsWith(attachmentPathPrefix(params.entityType, params.entityId))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Upload does not match this record" });
  }
  const ext = getExtension(params.blobPathname);
  if (!isAllowedExt(ext)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "File type not allowed" });
  }
  const fileName = sanitizeFileName(params.fileName);
  if (!fileName) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid file name" });
  }
  if (!(await entityExists(db, params.entityType, params.entityId))) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Record not found" });
  }

  let meta: { size: number };
  try {
    meta = await deps.head(params.blobPathname);
  } catch (err) {
    if (err instanceof BlobNotFoundError) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Upload not found" });
    }
    console.error("attachment.create: head failed", err);
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Storage unavailable" });
  }
  if (meta.size > MAX_UPLOAD_BYTES) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "File too large" });
  }

  try {
    return await db.$transaction(async (tx) => {
      const created = await tx.attachment.create({
        data: {
          entityType: params.entityType,
          entityId: params.entityId,
          fileName,
          blobPathname: params.blobPathname,
          fileSize: meta.size,
          mimeType: ALLOWED[ext].contentType,
          uploadedById: params.actorId,
        },
      });
      await logAudit(tx, {
        actorId: params.actorId,
        entityType: "ATTACHMENT",
        entityId: created.id,
        action: "CREATE",
        diff: toJsonSafe(created),
      });
      return created;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new TRPCError({ code: "CONFLICT", message: "File already attached" });
    }
    throw err;
  }
}

export async function deleteAttachment(
  db: PrismaClient,
  params: { actorId: string; actorRole: UserRole; id: string },
  deps: AttachmentDeleteDeps = { del: (pathname) => blobDel(pathname) },
): Promise<Attachment> {
  const deleted = await db.$transaction(async (tx) => {
    const attachment = await tx.attachment.findUnique({ where: { id: params.id } });
    if (!attachment) throw new TRPCError({ code: "NOT_FOUND", message: "Attachment not found" });
    if (
      attachment.uploadedById !== params.actorId &&
      params.actorRole !== "OWNER" &&
      params.actorRole !== "ADMIN"
    ) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to do this." });
    }
    const row = await tx.attachment.delete({ where: { id: params.id } });
    await logAudit(tx, {
      actorId: params.actorId,
      entityType: "ATTACHMENT",
      entityId: params.id,
      action: "DELETE",
      diff: toJsonSafe(row),
    });
    return row;
  });

  // Row first, blob after commit: the worst case is an unreachable orphan blob, never a dangling row.
  try {
    await deps.del(deleted.blobPathname);
  } catch (err) {
    console.error("attachment.delete: blob delete failed", deleted.blobPathname, err);
  }
  return deleted;
}
