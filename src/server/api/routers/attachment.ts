import { z } from "zod";
import { zId } from "@/lib/validation";
import { ATTACHMENT_PATH_RE } from "@/lib/attachments/file-policy";
import { ENTITY_TYPES } from "@/lib/entity-types";
import { createTRPCRouter, authedProcedure, authedProcedureNoTx } from "@/server/api/trpc";
import { createAttachment, deleteAttachment } from "@/server/services/attachments";

export const attachmentRouter = createTRPCRouter({
  forEntity: authedProcedure
    .input(z.object({ entityType: z.enum(ENTITY_TYPES), entityId: zId }))
    .query(({ ctx, input }) =>
      ctx.db.attachment.findMany({
        where: { entityType: input.entityType, entityId: input.entityId },
        orderBy: { createdAt: "desc" },
      }),
    ),

  // No transaction on create and delete: both call storage (see services/attachments.ts).
  create: authedProcedureNoTx
    .input(
      z.object({
        entityType: z.enum(ENTITY_TYPES),
        entityId: zId,
        fileName: z.string().min(1).max(255),
        blobPathname: z.string().max(200).regex(ATTACHMENT_PATH_RE),
      }),
    )
    .mutation(({ ctx, input }) => createAttachment(ctx.prisma, { actorId: ctx.userId, ...input })),

  delete: authedProcedureNoTx
    .input(z.object({ id: zId }))
    .mutation(({ ctx, input }) =>
      deleteAttachment(ctx.prisma, { actorId: ctx.userId, actorRole: ctx.user.role, id: input.id }),
    ),
});
