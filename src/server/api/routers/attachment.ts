import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { head, BlobNotFoundError } from "@vercel/blob";
import { Prisma } from "@generated/prisma/client";
import { zId } from "@/lib/validation";
import { MAX_UPLOAD_BYTES } from "@/lib/abuse-limits";
import { entityExists } from "@/lib/attachments/entity";
import {
  ALLOWED,
  ATTACHMENT_PATH_RE,
  getExtension,
  isAllowedExt,
  sanitizeFileName,
} from "@/lib/attachments/file-policy";
import { createTRPCRouter, authedProcedure } from "@/server/api/trpc";

const ENTITY_TYPES = ["CONTACT", "COMPANY", "DEAL", "LEAD"] as const;

export const attachmentRouter = createTRPCRouter({
  forEntity: authedProcedure
    .input(z.object({ entityType: z.enum(ENTITY_TYPES), entityId: zId }))
    .query(({ ctx, input }) =>
      ctx.db.attachment.findMany({
        where: { entityType: input.entityType, entityId: input.entityId },
        orderBy: { createdAt: "desc" },
      }),
    ),

  create: authedProcedure
    .input(
      z.object({
        entityType: z.enum(ENTITY_TYPES),
        entityId: zId,
        fileName: z.string().min(1).max(255),
        blobPathname: z.string().max(200).regex(ATTACHMENT_PATH_RE),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const prefix = `attachments/${input.entityType.toLowerCase()}/${input.entityId}/`;
      if (!input.blobPathname.startsWith(prefix)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Upload does not match this record" });
      }

      if (!(await entityExists(ctx.db, input.entityType, input.entityId))) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Record not found" });
      }

      let meta;
      try {
        meta = await head(input.blobPathname);
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

      const ext = getExtension(input.blobPathname);
      if (!isAllowedExt(ext)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "File type not allowed" });
      }
      const fileName = sanitizeFileName(input.fileName);
      if (!fileName) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid file name" });
      }

      try {
        return await ctx.db.attachment.create({
          data: {
            entityType: input.entityType,
            entityId: input.entityId,
            fileName,
            blobPathname: input.blobPathname,
            fileSize: meta.size,
            mimeType: ALLOWED[ext].contentType,
            uploadedById: ctx.userId,
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          throw new TRPCError({ code: "CONFLICT", message: "File already attached" });
        }
        throw err;
      }
    }),

  delete: authedProcedure
    .input(z.object({ id: zId }))
    .mutation(async ({ ctx, input }) => {
      const attachment = await ctx.db.attachment.findUniqueOrThrow({ where: { id: input.id } });
      if (
        attachment.uploadedById !== ctx.userId &&
        ctx.user.role !== "OWNER" &&
        ctx.user.role !== "ADMIN"
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to do this.",
        });
      }
      return ctx.db.attachment.delete({ where: { id: input.id } });
    }),
});
