import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, authedProcedure } from "@/server/api/trpc";

const ENTITY_TYPES = ["CONTACT", "COMPANY", "DEAL", "LEAD"] as const;

export const attachmentRouter = createTRPCRouter({
  forEntity: authedProcedure
    .input(z.object({ entityType: z.enum(ENTITY_TYPES), entityId: z.string() }))
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
        entityId: z.string(),
        fileName: z.string().min(1),
        fileUrl: z.string().min(1),
        fileSize: z.number().int().nonnegative(),
        mimeType: z.string().min(1),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.attachment.create({
        data: { ...input, uploadedById: ctx.userId },
      }),
    ),

  delete: authedProcedure
    .input(z.object({ id: z.string() }))
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
