import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { zId, zName, zShort, zLong, zIdArray, zCustomFields } from "@/lib/validation";
import { createTRPCRouter, authedProcedure, adminProcedure } from "@/server/api/trpc";
import { notify } from "@/lib/notify";
import { logAudit, toJsonSafe } from "@/lib/audit";

const DEAL_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

const dealInput = z.object({
  name: zName,
  contactId: zId.optional(),
  companyId: zId.optional(),
  stageId: zId,
  amount: z.number().nonnegative().max(9_999_999_999.99).optional(),
  currency: z.string().length(3).max(3).optional(),
  expectedCloseDate: z.coerce.date().optional(),
  priority: z.enum(DEAL_PRIORITIES).optional(),
  source: zShort.optional(),
  description: zLong.optional(),
  nextStep: zLong.optional(),
  customFields: zCustomFields.optional(),
});

export const dealRouter = createTRPCRouter({
  list: authedProcedure.query(({ ctx }) =>
    ctx.db.deal.findMany({
      include: { stage: true, contact: true, company: true },
      orderBy: { createdAt: "desc" },
    }),
  ),

  byId: authedProcedure.input(z.object({ id: zId })).query(({ ctx, input }) =>
    ctx.db.deal.findUniqueOrThrow({
      where: { id: input.id },
      include: {
        stage: true,
        contact: true,
        company: true,
        account: { select: { id: true } },
        activities: {
          where: { OR: [{ dealId: input.id }, { lead: { convertedDealId: input.id } }] },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
  ),

  create: authedProcedure
    .input(dealInput)
    .mutation(async ({ ctx, input }) => {
      const created = await ctx.db.deal.create({ data: { ...input } });
      await logAudit(ctx.db, {
        actorId: ctx.userId,
        entityType: "DEAL",
        entityId: created.id,
        action: "CREATE",
        diff: toJsonSafe(created),
      });
      return created;
    }),

  update: authedProcedure
    .input(dealInput.partial().extend({ id: zId }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const updated = await ctx.db.deal.update({ where: { id }, data });
      await logAudit(ctx.db, {
        actorId: ctx.userId,
        entityType: "DEAL",
        entityId: id,
        action: "UPDATE",
        diff: toJsonSafe(data),
      });
      return updated;
    }),

  moveStage: authedProcedure
    .input(z.object({ id: zId, stageId: zId }))
    .mutation(async ({ ctx, input }) => {
      const converted = await ctx.db.account.findUnique({
        where: { sourceDealId: input.id },
        select: { id: true },
      });
      if (converted) {
        throw new TRPCError({ code: "CONFLICT", message: "This deal was converted to an account and can no longer change stage" });
      }
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

      await logAudit(ctx.db, {
        actorId: ctx.userId,
        entityType: "DEAL",
        entityId: deal.id,
        action: "UPDATE",
        diff: { stageId: input.stageId, status: deal.status },
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

  convertToAccount: authedProcedure
    .input(z.object({ id: zId }))
    .mutation(async ({ ctx, input }) => {
      const deal = await ctx.db.deal.findUniqueOrThrow({
        where: { id: input.id },
        include: { company: true, account: true },
      });
      if (deal.account) return deal.account;
      if (deal.status !== "WON") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only won deals can be converted to an account" });
      }
      const account = await ctx.db.account.create({
        data: {
          name: deal.company?.name ?? deal.name,
          contractValue: deal.amount,
          sourceDealId: deal.id,
          companyId: deal.companyId,
          contactId: deal.contactId,
          ownerId: deal.ownerId,
        },
      });
      await logAudit(ctx.db, {
        actorId: ctx.userId,
        entityType: "ACCOUNT",
        entityId: account.id,
        action: "CREATE",
        diff: toJsonSafe(account),
      });
      return account;
    }),

  delete: adminProcedure
    .input(z.object({ id: zId }))
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
    .input(z.object({ ids: zIdArray }))
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
    .input(z.object({ ids: zIdArray, stageId: zId }))
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
