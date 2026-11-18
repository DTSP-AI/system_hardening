import { z } from "zod";
import { zId, zName, zShort, zDomain, zIdArray, zCustomFields, zImportRows } from "@/lib/validation";
import { createTRPCRouter, authedProcedure, adminProcedure } from "@/server/api/trpc";
import { logAudit, toJsonSafe } from "@/lib/audit";

const companyInput = z.object({
  name: zName,
  domain: zDomain.optional(),
  industry: zShort.optional(),
  addressLine1: zShort.optional(),
  addressLine2: zShort.optional(),
  city: zShort.optional(),
  state: zShort.optional(),
  postalCode: zShort.optional(),
  country: zShort.optional(),
  customFields: zCustomFields.optional(),
});

export const companyRouter = createTRPCRouter({
  list: authedProcedure.query(({ ctx }) =>
    ctx.db.company.findMany({
      orderBy: { createdAt: "desc" },
    }),
  ),

  byId: authedProcedure.input(z.object({ id: zId })).query(({ ctx, input }) =>
    ctx.db.company.findUniqueOrThrow({
      where: { id: input.id },
      include: {
        contacts: true,
        deals: { include: { stage: true } },
      },
    }),
  ),

  create: authedProcedure
    .input(companyInput)
    .mutation(({ ctx, input }) =>
      ctx.db.company.create({ data: { ...input } }),
    ),

  update: authedProcedure
    .input(companyInput.partial().extend({ id: zId }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.company.update({ where: { id }, data });
    }),

  delete: adminProcedure
    .input(z.object({ id: zId }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db.company.delete({ where: { id: input.id } });
      await logAudit(ctx.db, {
        actorId: ctx.userId,
        entityType: "COMPANY",
        entityId: input.id,
        action: "DELETE",
        diff: toJsonSafe(deleted),
      });
      return deleted;
    }),

  deleteMany: adminProcedure
    .input(z.object({ ids: zIdArray }))
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.company.findMany({ where: { id: { in: input.ids } } });
      const result = await ctx.db.company.deleteMany({ where: { id: { in: input.ids } } });
      for (const row of rows) {
        await logAudit(ctx.db, {
          actorId: ctx.userId,
          entityType: "COMPANY",
          entityId: row.id,
          action: "DELETE",
          diff: toJsonSafe(row),
        });
      }
      return result;
    }),

  bulkCreate: adminProcedure
    .input(z.object({ rows: zImportRows(companyInput) }))
    .mutation(({ ctx, input }) =>
      ctx.db.company.createMany({
        data: input.rows.map((row) => ({ ...row })),
      }),
    ),
});
