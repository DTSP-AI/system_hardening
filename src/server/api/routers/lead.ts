import { z } from "zod";
import { createTRPCRouter, tenantProcedure, adminProcedure } from "@/server/api/trpc";
import { notify } from "@/lib/notify";
import { logAudit, toJsonSafe } from "@/lib/audit";

const leadInput = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.email().optional(),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  jobTitle: z.string().optional(),
  source: z.string().optional(),
});

const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "UNQUALIFIED", "CONVERTED"] as const;

export const leadRouter = createTRPCRouter({
  list: tenantProcedure.query(({ ctx }) =>
    ctx.db.lead.findMany({ orderBy: { createdAt: "desc" } }),
  ),

  byId: tenantProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => ctx.db.lead.findUniqueOrThrow({ where: { id: input.id } })),

  create: tenantProcedure
    .input(leadInput)
    .mutation(({ ctx, input }) => ctx.db.lead.create({ data: { ...input, tenantId: ctx.tenantId } })),

  update: tenantProcedure
    .input(leadInput.partial().extend({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.lead.update({ where: { id }, data });
    }),

  setStatus: tenantProcedure
    .input(z.object({ id: z.string(), status: z.enum(LEAD_STATUSES) }))
    .mutation(({ ctx, input }) =>
      ctx.db.lead.update({ where: { id: input.id }, data: { status: input.status } }),
    ),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db.lead.delete({ where: { id: input.id } });
      await logAudit(ctx.db, ctx.tenantId, {
        actorId: ctx.userId,
        entityType: "LEAD",
        entityId: input.id,
        action: "DELETE",
        diff: toJsonSafe(deleted),
      });
      return deleted;
    }),

  deleteMany: adminProcedure
    .input(z.object({ ids: z.array(z.string()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.lead.findMany({ where: { id: { in: input.ids } } });
      const result = await ctx.db.lead.deleteMany({ where: { id: { in: input.ids } } });
      for (const row of rows) {
        await logAudit(ctx.db, ctx.tenantId, {
          actorId: ctx.userId,
          entityType: "LEAD",
          entityId: row.id,
          action: "DELETE",
          diff: toJsonSafe(row),
        });
      }
      return result;
    }),

  bulkCreate: adminProcedure
    .input(z.object({ rows: z.array(leadInput) }))
    .mutation(({ ctx, input }) =>
      ctx.db.lead.createMany({
        data: input.rows.map((row) => ({ ...row, tenantId: ctx.tenantId })),
      }),
    ),

  convert: tenantProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.db.lead.findUniqueOrThrow({ where: { id: input.id } });

      let companyId: string | undefined;
      if (lead.companyName) {
        const existing = await ctx.db.company.findFirst({ where: { name: lead.companyName } });
        companyId = existing
          ? existing.id
          : (
              await ctx.db.company.create({
                data: { name: lead.companyName, tenantId: ctx.tenantId },
              })
            ).id;
      }

      const contact = await ctx.db.contact.create({
        data: {
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          phone: lead.phone,
          jobTitle: lead.jobTitle,
          leadSource: lead.source,
          companyId,
          tenantId: ctx.tenantId,
        },
      });

      await ctx.db.lead.update({
        where: { id: lead.id },
        data: { status: "CONVERTED", convertedContactId: contact.id },
      });

      if (lead.ownerId && lead.ownerId !== ctx.userId) {
        await notify(ctx.db, ctx.tenantId, {
          userId: lead.ownerId,
          type: "LEAD_CONVERTED",
          title: `${lead.firstName} ${lead.lastName} converted to a contact`,
          linkHref: `/contacts/${contact.id}`,
        });
      }

      return contact;
    }),
});
