import { z } from "zod";
import { createTRPCRouter, authedProcedure, adminProcedure } from "@/server/api/trpc";
import { notify } from "@/lib/notify";
import { logAudit, toJsonSafe } from "@/lib/audit";

const DEAL_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

const dealInput = z.object({
  name: z.string().min(1),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  stageId: z.string(),
  amount: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  expectedCloseDate: z.coerce.date().optional(),
  priority: z.enum(DEAL_PRIORITIES).optional(),
  source: z.string().optional(),
  description: z.string().optional(),
  nextStep: z.string().optional(),
  customFields: z.record(z.string(), z.any()).optional(),
});

export const dealRouter = createTRPCRouter({
  list: authedProcedure.query(({ ctx }) =>
    ctx.db.deal.findMany({
      include: { stage: true, contact: true, company: true },
      orderBy: { createdAt: "desc" },
    }),
  ),

  byId: authedProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) =>
    ctx.db.deal.findUniqueOrThrow({
      where: { id: input.id },
      include: {
        stage: true,
        contact: true,
        company: true,
        activities: { orderBy: { createdAt: "desc" } },
      },
    }),
  ),

  create: authedProcedure
    .input(dealInput)
    .mutation(({ ctx, input }) =>
      ctx.db.deal.create({ data: { ...input } }),
    ),

  update: authedProcedure
    .input(dealInput.partial().extend({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.deal.update({ where: { id }, data });
    }),

  moveStage: authedProcedure
    .input(z.object({ id: z.string(), stageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const stage = await ctx.db.pipelineStage.findUniqueOrThrow({
        where: { id: input.stageId },
      });
      const deal = await ctx.db.deal.update({
        where: { id: input.id },
        data: {
          stageId: input.stageId,
          status: stage.isWon ? "WON" : stage.isLost ? "LOST" : "OPEN",
          closedAt: stage.isWon || stage.isLost ? new Date() : null,
        },
      });

      if (deal.ownerId && deal.ownerId !== ctx.userId) {
        await notify(ctx.db, {
          userId: deal.ownerId,
          type: "DEAL_STAGE_CHANGE",
          title: `${deal.name} moved to ${stage.name}`,
          linkHref: `/deals/${deal.id}`,
        });
      }

      return deal;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db.deal.delete({ where: { id: input.id } });
      await logAudit(ctx.db, {
        actorId: ctx.userId,
        entityType: "DEAL",
        entityId: input.id,
        action: "DELETE",
        diff: toJsonSafe(deleted),
      });
      return deleted;
    }),

  deleteMany: adminProcedure
    .input(z.object({ ids: z.array(z.string()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.deal.findMany({ where: { id: { in: input.ids } } });
      const result = await ctx.db.deal.deleteMany({ where: { id: { in: input.ids } } });
      for (const row of rows) {
        await logAudit(ctx.db, {
          actorId: ctx.userId,
          entityType: "DEAL",
          entityId: row.id,
          action: "DELETE",
          diff: toJsonSafe(row),
        });
      }
      return result;
    }),

  moveStageMany: authedProcedure
    .input(z.object({ ids: z.array(z.string()).min(1), stageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const stage = await ctx.db.pipelineStage.findUniqueOrThrow({
        where: { id: input.stageId },
      });
      const status = stage.isWon ? "WON" : stage.isLost ? "LOST" : "OPEN";
      const closedAt = stage.isWon || stage.isLost ? new Date() : null;

      const deals = await ctx.db.deal.findMany({ where: { id: { in: input.ids } } });
      await ctx.db.deal.updateMany({
        where: { id: { in: input.ids } },
        data: { stageId: input.stageId, status, closedAt },
      });

      for (const deal of deals) {
        if (deal.ownerId && deal.ownerId !== ctx.userId) {
          await notify(ctx.db, {
            userId: deal.ownerId,
            type: "DEAL_STAGE_CHANGE",
            title: `${deal.name} moved to ${stage.name}`,
            linkHref: `/deals/${deal.id}`,
          });
        }
      }

      return { count: deals.length };
    }),
});
