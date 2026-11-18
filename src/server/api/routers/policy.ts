import { z } from "zod";
import { createTRPCRouter, insuranceProcedure, insuranceAdminProcedure } from "@/server/api/trpc";
import { notify } from "@/lib/notify";
import { logAudit, toJsonSafe } from "@/lib/audit";

const LINES_OF_BUSINESS = [
  "PERSONAL_AUTO",
  "HOMEOWNERS",
  "RENTERS",
  "CONDO",
  "DWELLING_FIRE",
  "PERSONAL_UMBRELLA",
  "MOTORCYCLE",
  "BOAT",
  "RV",
  "FLOOD",
  "COMMERCIAL_AUTO",
  "GENERAL_LIABILITY",
  "COMMERCIAL_PROPERTY",
  "BOP",
  "WORKERS_COMP",
  "COMMERCIAL_UMBRELLA",
  "PROFESSIONAL_LIABILITY",
  "CYBER",
  "INLAND_MARINE",
  "OTHER",
] as const;

const POLICY_STATUSES = [
  "QUOTE",
  "ACTIVE",
  "PENDING_RENEWAL",
  "RENEWED",
  "CANCELLED",
  "NON_RENEWED",
  "EXPIRED",
] as const;

const BILLING_TYPES = ["DIRECT_BILL", "AGENCY_BILL"] as const;

const policyInput = z.object({
  policyNumber: z.string().min(1),
  lineOfBusiness: z.enum(LINES_OF_BUSINESS),
  billingType: z.enum(BILLING_TYPES).optional(),
  premium: z.number().nonnegative(),
  effectiveDate: z.coerce.date(),
  expirationDate: z.coerce.date(),
  carrierId: z.string(),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  ownerId: z.string().optional(),
  customFields: z.record(z.string(), z.any()).optional(),
});

export const policyRouter = createTRPCRouter({
  list: insuranceProcedure
    .input(
      z.object({
        status: z.enum(POLICY_STATUSES).optional(),
        lineOfBusiness: z.enum(LINES_OF_BUSINESS).optional(),
        carrierId: z.string().optional(),
      }).optional(),
    )
    .query(({ ctx, input }) =>
      ctx.db.policy.findMany({
        where: {
          status: input?.status,
          lineOfBusiness: input?.lineOfBusiness,
          carrierId: input?.carrierId,
        },
        include: { carrier: true, contact: true, company: true },
        orderBy: { createdAt: "desc" },
      }),
    ),

  byId: insuranceProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) =>
    ctx.db.policy.findUniqueOrThrow({
      where: { id: input.id },
      include: {
        carrier: true,
        contact: true,
        company: true,
        commissions: { orderBy: { createdAt: "desc" } },
        claims: { orderBy: { createdAt: "desc" } },
        activities: { orderBy: { createdAt: "desc" } },
        renewedFrom: true,
      },
    }),
  ),

  expiringSoon: insuranceProcedure
    .input(z.object({ withinDays: z.number().default(90) }).optional())
    .query(({ ctx, input }) => {
      const withinDays = input?.withinDays ?? 90;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + withinDays);
      return ctx.db.policy.findMany({
        where: { status: "ACTIVE", expirationDate: { lte: cutoff } },
        include: { carrier: true, contact: true, company: true },
        orderBy: { expirationDate: "asc" },
      });
    }),

  create: insuranceProcedure
    .input(policyInput)
    .mutation(({ ctx, input }) =>
      ctx.db.policy.create({ data: { ...input, tenantId: ctx.tenantId } }),
    ),

  update: insuranceProcedure
    .input(policyInput.partial().extend({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.policy.update({ where: { id }, data });
    }),

  setStatus: insuranceProcedure
    .input(z.object({ id: z.string(), status: z.enum(POLICY_STATUSES) }))
    .mutation(async ({ ctx, input }) => {
      const policy = await ctx.db.policy.update({
        where: { id: input.id },
        data: { status: input.status },
      });

      if (policy.ownerId && policy.ownerId !== ctx.userId) {
        await notify(ctx.db, ctx.tenantId, {
          userId: policy.ownerId,
          type: "POLICY_STATUS_CHANGE",
          title: `Policy ${policy.policyNumber} moved to ${input.status}`,
          linkHref: `/policies/${policy.id}`,
        });
      }

      return policy;
    }),

  renew: insuranceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const source = await ctx.db.policy.findUniqueOrThrow({ where: { id: input.id } });

      const newExpiration = new Date(source.expirationDate);
      newExpiration.setFullYear(newExpiration.getFullYear() + 1);

      const renewed = await ctx.db.policy.create({
        data: {
          tenantId: ctx.tenantId,
          policyNumber: source.policyNumber,
          lineOfBusiness: source.lineOfBusiness,
          billingType: source.billingType,
          premium: source.premium,
          effectiveDate: source.expirationDate,
          expirationDate: newExpiration,
          carrierId: source.carrierId,
          contactId: source.contactId,
          companyId: source.companyId,
          ownerId: source.ownerId,
          status: "ACTIVE",
          renewedFromId: source.id,
        },
      });

      await ctx.db.policy.update({
        where: { id: source.id },
        data: { status: "RENEWED" },
      });

      return renewed;
    }),

  delete: insuranceAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db.policy.delete({ where: { id: input.id } });
      await logAudit(ctx.db, ctx.tenantId, {
        actorId: ctx.userId,
        entityType: "POLICY",
        entityId: input.id,
        action: "DELETE",
        diff: toJsonSafe(deleted),
      });
      return deleted;
    }),

  deleteMany: insuranceAdminProcedure
    .input(z.object({ ids: z.array(z.string()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.policy.findMany({ where: { id: { in: input.ids } } });
      const result = await ctx.db.policy.deleteMany({ where: { id: { in: input.ids } } });
      for (const row of rows) {
        await logAudit(ctx.db, ctx.tenantId, {
          actorId: ctx.userId,
          entityType: "POLICY",
          entityId: row.id,
          action: "DELETE",
          diff: toJsonSafe(row),
        });
      }
      return result;
    }),
});
