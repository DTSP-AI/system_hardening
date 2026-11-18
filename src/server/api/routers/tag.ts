import { z } from "zod";
import { createTRPCRouter, tenantProcedure, adminProcedure } from "@/server/api/trpc";

const ENTITY_TYPES = ["CONTACT", "COMPANY", "DEAL", "LEAD"] as const;

export const tagRouter = createTRPCRouter({
  list: tenantProcedure.query(({ ctx }) =>
    ctx.db.tag.findMany({ orderBy: { name: "asc" } }),
  ),

  create: tenantProcedure
    .input(z.object({ name: z.string().min(1), color: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      ctx.db.tag.create({ data: { ...input, tenantId: ctx.tenantId } }),
    ),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.db.tag.delete({ where: { id: input.id } })),

  forEntity: tenantProcedure
    .input(z.object({ entityType: z.enum(ENTITY_TYPES), entityId: z.string() }))
    .query(({ ctx, input }) =>
      ctx.db.tagAssignment.findMany({
        where: { entityType: input.entityType, entityId: input.entityId },
        include: { tag: true },
      }),
    ),

  assign: tenantProcedure
    .input(
      z.object({
        tagId: z.string(),
        entityType: z.enum(ENTITY_TYPES),
        entityId: z.string(),
      }),
    )
    .mutation(({ ctx, input }) => ctx.db.tagAssignment.create({ data: { ...input, tenantId: ctx.tenantId } })),

  unassign: tenantProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.db.tagAssignment.delete({ where: { id: input.id } })),

  assignMany: tenantProcedure
    .input(
      z.object({
        tagId: z.string(),
        entityType: z.enum(ENTITY_TYPES),
        entityIds: z.array(z.string()).min(1),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.tagAssignment.createMany({
        data: input.entityIds.map((entityId) => ({
          tagId: input.tagId,
          entityType: input.entityType,
          entityId,
          tenantId: ctx.tenantId,
        })),
        skipDuplicates: true,
      }),
    ),
});
