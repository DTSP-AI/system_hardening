import { z } from "zod";
import { zId, zName, zIdArray } from "@/lib/validation";
import { createTRPCRouter, authedProcedure, adminProcedure } from "@/server/api/trpc";
import { logAudit, toJsonSafe } from "@/lib/audit";

const ACCOUNT_STATUSES = ["ACTIVE", "CHURNED"] as const;

const accountUpdateInput = z.object({
  id: zId,
  name: zName.optional(),
  status: z.enum(ACCOUNT_STATUSES).optional(),
  startDate: z.coerce.date().optional(),
  contractValue: z.number().nonnegative().max(1_000_000_000_000).optional(),
});

// Accounts are created only by deal.convertToAccount (a Won deal becomes an account),
// so there is deliberately no `create` mutation here.
export const accountRouter = createTRPCRouter({
  list: authedProcedure.query(({ ctx }) =>
    ctx.db.account.findMany({
      include: { company: true, contact: true },
      orderBy: { createdAt: "desc" },
    }),
  ),

  byId: authedProcedure.input(z.object({ id: zId })).query(async ({ ctx, input }) => {
    const account = await ctx.db.account.findUniqueOrThrow({
      where: { id: input.id },
      include: {
        company: true,
        contact: true,
        sourceDeal: { select: { id: true, name: true } },
      },
    });
    // Journey: account activity + the source deal's + the originating lead's.
    const activities = await ctx.db.activity.findMany({
      where: {
        OR: [
          { accountId: account.id },
          ...(account.sourceDealId
            ? [{ dealId: account.sourceDealId }, { lead: { convertedDealId: account.sourceDealId } }]
            : []),
        ],
      },
      orderBy: { createdAt: "desc" },
    });
    return { ...account, activities };
  }),

  update: authedProcedure.input(accountUpdateInput).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    const updated = await ctx.db.account.update({ where: { id }, data });
    await logAudit(ctx.db, {
      actorId: ctx.userId,
      entityType: "ACCOUNT",
      entityId: id,
      action: "UPDATE",
      diff: toJsonSafe(data),
    });
    return updated;
  }),

  delete: adminProcedure.input(z.object({ id: zId })).mutation(async ({ ctx, input }) => {
    const deleted = await ctx.db.account.delete({ where: { id: input.id } });
    await logAudit(ctx.db, {
      actorId: ctx.userId,
      entityType: "ACCOUNT",
      entityId: input.id,
      action: "DELETE",
      diff: toJsonSafe(deleted),
    });
    return deleted;
  }),

  deleteMany: adminProcedure
    .input(z.object({ ids: zIdArray }))
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.account.findMany({ where: { id: { in: input.ids } } });
      const result = await ctx.db.account.deleteMany({ where: { id: { in: input.ids } } });
      for (const row of rows) {
        await logAudit(ctx.db, {
          actorId: ctx.userId,
          entityType: "ACCOUNT",
          entityId: row.id,
          action: "DELETE",
          diff: toJsonSafe(row),
        });
      }
      return result;
    }),
});
