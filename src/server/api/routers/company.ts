import { z } from "zod";
import { createTRPCRouter, tenantProcedure, adminProcedure } from "@/server/api/trpc";
import { logAudit, toJsonSafe } from "@/lib/audit";

const companyInput = z.object({
  name: z.string().min(1),
  domain: z.string().optional(),
  industry: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  customFields: z.record(z.string(), z.any()).optional(),
});

export const companyRouter = createTRPCRouter({
  list: tenantProcedure.query(({ ctx }) =>
    ctx.db.company.findMany({
      orderBy: { createdAt: "desc" },
    }),
  ),

  byId: tenantProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) =>
    ctx.db.company.findUniqueOrThrow({
      where: { id: input.id },
      include: {
        contacts: true,
        deals: { include: { stage: true } },
        policies: { include: { carrier: true } },
      },
    }),
  ),

  create: tenantProcedure
    .input(companyInput)
    .mutation(({ ctx, input }) =>
      ctx.db.company.create({ data: { ...input, tenantId: ctx.tenantId } }),
    ),

  update: tenantProcedure
    .input(companyInput.partial().extend({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.company.update({ where: { id }, data });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db.company.delete({ where: { id: input.id } });
      await logAudit(ctx.db, ctx.tenantId, {
        actorId: ctx.userId,
        entityType: "COMPANY",
        entityId: input.id,
        action: "DELETE",
        diff: toJsonSafe(deleted),
      });
      return deleted;
    }),

  deleteMany: adminProcedure
    .input(z.object({ ids: z.array(z.string()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.company.findMany({ where: { id: { in: input.ids } } });
      const result = await ctx.db.company.deleteMany({ where: { id: { in: input.ids } } });
      for (const row of rows) {
        await logAudit(ctx.db, ctx.tenantId, {
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
    .input(z.object({ rows: z.array(companyInput) }))
    .mutation(({ ctx, input }) =>
      ctx.db.company.createMany({
        data: input.rows.map((row) => ({ ...row, tenantId: ctx.tenantId })),
      }),
    ),
});
