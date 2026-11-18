import { z } from "zod";
import { zId, zName } from "@/lib/validation";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, authedProcedure, adminProcedure } from "@/server/api/trpc";

export const pipelineStageRouter = createTRPCRouter({
  list: authedProcedure.query(({ ctx }) =>
    ctx.db.pipelineStage.findMany({ orderBy: { sortOrder: "asc" } }),
  ),

  reorder: adminProcedure
    .input(z.object({ id: zId, sortOrder: z.number().int().min(0).max(1000) }))
    .mutation(({ ctx, input }) =>
      ctx.db.pipelineStage.update({
        where: { id: input.id },
        data: { sortOrder: input.sortOrder },
      }),
    ),

  create: adminProcedure
    .input(
      z.object({
        name: zName,
        isWon: z.boolean().default(false),
        isLost: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { _max } = await ctx.db.pipelineStage.aggregate({ _max: { sortOrder: true } });
      return ctx.db.pipelineStage.create({
        data: {
          name: input.name,
          isWon: input.isWon,
          isLost: input.isLost,
          sortOrder: (_max.sortOrder ?? -1) + 1,
        },
      });
    }),

  rename: adminProcedure
    .input(z.object({ id: zId, name: zName }))
    .mutation(({ ctx, input }) =>
      ctx.db.pipelineStage.update({ where: { id: input.id }, data: { name: input.name } }),
    ),

  delete: adminProcedure.input(z.object({ id: zId })).mutation(async ({ ctx, input }) => {
    const dealCount = await ctx.db.deal.count({ where: { stageId: input.id } });
    if (dealCount > 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Can't delete a stage with ${dealCount} deal(s) still in it. Move them first.`,
      });
    }
    return ctx.db.pipelineStage.delete({ where: { id: input.id } });
  }),
});
