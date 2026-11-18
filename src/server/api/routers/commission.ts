import { z } from "zod";
import { createTRPCRouter, tenantProcedure, adminProcedure } from "@/server/api/trpc";

const COMMISSION_TYPES = ["NEW_BUSINESS", "RENEWAL", "CHARGEBACK", "BONUS"] as const;

const commissionInput = z.object({
  policyId: z.string(),
  type: z.enum(COMMISSION_TYPES),
  amount: z.number(),
  rate: z.number().nonnegative().optional(),
  statementDate: z.coerce.date().optional(),
  receivedAt: z.coerce.date().optional(),
  paid: z.boolean().optional(),
});

export const commissionRouter = createTRPCRouter({
  list: tenantProcedure
    .input(z.object({ policyId: z.string().optional() }).optional())
    .query(({ ctx, input }) =>
      ctx.db.commission.findMany({
        where: { policyId: input?.policyId },
        include: { policy: { include: { carrier: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ),

  byId: tenantProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) =>
    ctx.db.commission.findUniqueOrThrow({
      where: { id: input.id },
      include: { policy: true },
    }),
  ),

  summary: tenantProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [monthTotal, yearTotal, byCarrier] = await Promise.all([
      ctx.db.commission.aggregate({
        _sum: { amount: true },
        where: { createdAt: { gte: monthStart } },
      }),
      ctx.db.commission.aggregate({
        _sum: { amount: true },
        where: { createdAt: { gte: yearStart } },
      }),
      ctx.db.commission.findMany({
        where: { createdAt: { gte: yearStart } },
        include: { policy: { include: { carrier: true } } },
      }),
    ]);

    const carrierTotals = new Map<string, { name: string; total: number }>();
    for (const c of byCarrier) {
      const key = c.policy.carrier.id;
      const existing = carrierTotals.get(key);
      const amount = Number(c.amount);
      if (existing) {
        existing.total += amount;
      } else {
        carrierTotals.set(key, { name: c.policy.carrier.name, total: amount });
      }
    }

    return {
      monthTotal: Number(monthTotal._sum.amount ?? 0),
      yearTotal: Number(yearTotal._sum.amount ?? 0),
      byCarrier: Array.from(carrierTotals.values()).sort((a, b) => b.total - a.total),
    };
  }),

  create: tenantProcedure
    .input(commissionInput)
    .mutation(({ ctx, input }) =>
      ctx.db.commission.create({ data: { ...input, tenantId: ctx.tenantId } }),
    ),

  update: tenantProcedure
    .input(commissionInput.partial().extend({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.commission.update({ where: { id }, data });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.db.commission.delete({ where: { id: input.id } })),
});
