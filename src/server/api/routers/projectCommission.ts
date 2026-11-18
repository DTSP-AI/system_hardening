import { z } from "zod";
import { createTRPCRouter, tenantProcedure, adminProcedure } from "@/server/api/trpc";

const PROJECT_COMMISSION_TYPES = ["SALE", "REFERRAL", "BONUS", "CHARGEBACK"] as const;

const projectCommissionInput = z.object({
  projectId: z.string(),
  type: z.enum(PROJECT_COMMISSION_TYPES),
  amount: z.number(),
  rate: z.number().nonnegative().optional(),
  statementDate: z.coerce.date().optional(),
  receivedAt: z.coerce.date().optional(),
  paid: z.boolean().optional(),
});

export const projectCommissionRouter = createTRPCRouter({
  list: tenantProcedure
    .input(z.object({ projectId: z.string().optional() }).optional())
    .query(({ ctx, input }) =>
      ctx.db.projectCommission.findMany({
        where: { projectId: input?.projectId },
        include: { project: true },
        orderBy: { createdAt: "desc" },
      }),
    ),

  byId: tenantProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) =>
    ctx.db.projectCommission.findUniqueOrThrow({
      where: { id: input.id },
      include: { project: true },
    }),
  ),

  summary: tenantProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [monthTotal, yearTotal] = await Promise.all([
      ctx.db.projectCommission.aggregate({
        _sum: { amount: true },
        where: { createdAt: { gte: monthStart } },
      }),
      ctx.db.projectCommission.aggregate({
        _sum: { amount: true },
        where: { createdAt: { gte: yearStart } },
      }),
    ]);

    return {
      monthTotal: Number(monthTotal._sum.amount ?? 0),
      yearTotal: Number(yearTotal._sum.amount ?? 0),
    };
  }),

  create: tenantProcedure
    .input(projectCommissionInput)
    .mutation(({ ctx, input }) =>
      ctx.db.projectCommission.create({ data: { ...input, tenantId: ctx.tenantId } }),
    ),

  update: tenantProcedure
    .input(projectCommissionInput.partial().extend({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.projectCommission.update({ where: { id }, data });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.db.projectCommission.delete({ where: { id: input.id } })),
});
