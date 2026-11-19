import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { zId, zName, zShort, zLong, zIdArray, zCustomFields } from "@/lib/validation";
import { createTRPCRouter, authedProcedure, adminProcedure } from "@/server/api/trpc";
import {
  changeDealStage,
  convertDealToAccount,
  stageFieldsForCreate,
} from "@/server/services/deal-stage";
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
      const stage = await stageFieldsForCreate(ctx.db, input.stageId);
      const created = await ctx.db.deal.create({ data: { ...input, ...stage } });
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
    // No stageId here: a stage change is deal.moveStage (see services/deal-stage.ts).
    .input(dealInput.omit({ stageId: true }).partial().extend({ id: zId }))
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
      const [deal] = await changeDealStage(ctx.db, {
        actorId: ctx.userId,
        dealIds: [input.id],
        stageId: input.stageId,
      });
      if (!deal) throw new TRPCError({ code: "NOT_FOUND", message: "Deal not found" });
      return deal;
    }),

  convertToAccount: authedProcedure
    .input(z.object({ id: zId }))
    .mutation(({ ctx, input }) => convertDealToAccount(ctx.db, { actorId: ctx.userId, dealId: input.id })),

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
      const moved = await changeDealStage(ctx.db, {
        actorId: ctx.userId,
        dealIds: input.ids,
        stageId: input.stageId,
      });
      return { count: moved.length };
    }),
});
