import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "@/server/api/trpc";
import { requireRole } from "@/lib/rbac";

const ENTITY_TYPES = ["CONTACT", "COMPANY", "DEAL", "LEAD"] as const;

export const attachmentRouter = createTRPCRouter({
  forEntity: tenantProcedure
    .input(z.object({ entityType: z.enum(ENTITY_TYPES), entityId: z.string() }))
    .query(({ ctx, input }) =>
      ctx.db.attachment.findMany({
        where: { entityType: input.entityType, entityId: input.entityId },
        orderBy: { createdAt: "desc" },
      }),
    ),

  create: tenantProcedure
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
        data: { ...input, uploadedById: ctx.userId, tenantId: ctx.tenantId },
      }),
    ),

  delete: tenantProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const attachment = await ctx.db.attachment.findUniqueOrThrow({ where: { id: input.id } });
      if (attachment.uploadedById !== ctx.userId) {
        await requireRole(
          ctx.db,
          { tenantId: ctx.tenantId, clerkOrgId: ctx.orgId!, clerkUserId: ctx.userId },
          ["OWNER", "ADMIN"],
        );
      }
      return ctx.db.attachment.delete({ where: { id: input.id } });
    }),
});
