import { z } from "zod";
import { createTRPCRouter, tenantProcedure, adminProcedure } from "@/server/api/trpc";
import { notify } from "@/lib/notify";

const CLAIM_STATUSES = ["OPEN", "CLOSED", "DENIED", "REOPENED"] as const;

const claimInput = z.object({
  policyId: z.string(),
  claimNumber: z.string().min(1),
  dateOfLoss: z.coerce.date(),
  description: z.string().optional(),
  reserveAmount: z.number().nonnegative().optional(),
  paidAmount: z.number().nonnegative().optional(),
  adjusterName: z.string().optional(),
  adjusterPhone: z.string().optional(),
});

export const claimRouter = createTRPCRouter({
  list: tenantProcedure
    .input(
      z.object({ policyId: z.string().optional(), status: z.enum(CLAIM_STATUSES).optional() }).optional(),
    )
    .query(({ ctx, input }) =>
      ctx.db.claim.findMany({
        where: { policyId: input?.policyId, status: input?.status },
        include: { policy: { include: { carrier: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ),

  byId: tenantProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) =>
    ctx.db.claim.findUniqueOrThrow({
      where: { id: input.id },
      include: { policy: { include: { carrier: true, contact: true, company: true } } },
    }),
  ),

  create: tenantProcedure
    .input(claimInput)
    .mutation(({ ctx, input }) =>
      ctx.db.claim.create({ data: { ...input, tenantId: ctx.tenantId } }),
    ),

  update: tenantProcedure
    .input(claimInput.partial().extend({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.claim.update({ where: { id }, data });
    }),

  setStatus: tenantProcedure
    .input(z.object({ id: z.string(), status: z.enum(CLAIM_STATUSES) }))
    .mutation(async ({ ctx, input }) => {
      const claim = await ctx.db.claim.update({
        where: { id: input.id },
        data: {
          status: input.status,
          closedAt: input.status === "CLOSED" || input.status === "DENIED" ? new Date() : null,
        },
        include: { policy: true },
      });

      if (claim.policy.ownerId && claim.policy.ownerId !== ctx.userId) {
        await notify(ctx.db, ctx.tenantId, {
          userId: claim.policy.ownerId,
          type: "CLAIM_STATUS_CHANGE",
          title: `Claim ${claim.claimNumber} moved to ${input.status}`,
          linkHref: `/policies/${claim.policyId}`,
        });
      }

      return claim;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.db.claim.delete({ where: { id: input.id } })),
});
