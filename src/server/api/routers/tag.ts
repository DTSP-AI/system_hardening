import { z } from "zod";
import { createTRPCRouter, authedProcedure, adminProcedure } from "@/server/api/trpc";

const ENTITY_TYPES = ["CONTACT", "COMPANY", "DEAL", "LEAD"] as const;

export const tagRouter = createTRPCRouter({
  list: authedProcedure.query(({ ctx }) =>
    ctx.db.tag.findMany({ orderBy: { name: "asc" } }),
  ),

  create: authedProcedure
    .input(z.object({ name: z.string().min(1), color: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      ctx.db.tag.create({ data: { ...input } }),
    ),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.db.tag.delete({ where: { id: input.id } })),

  forEntity: authedProcedure
    .input(z.object({ entityType: z.enum(ENTITY_TYPES), entityId: z.string() }))
    .query(({ ctx, input }) =>
      ctx.db.tagAssignment.findMany({
        where: { entityType: input.entityType, entityId: input.entityId },
        include: { tag: true },
      }),
    ),

  assign: authedProcedure
    .input(
      z.object({
        tagId: z.string(),
        entityType: z.enum(ENTITY_TYPES),
        entityId: z.string(),
      }),
    )
    .mutation(({ ctx, input }) => ctx.db.tagAssignment.create({ data: { ...input } })),

  unassign: authedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.db.tagAssignment.delete({ where: { id: input.id } })),

  assignMany: authedProcedure
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
        })),
        skipDuplicates: true,
      }),
    ),
});
