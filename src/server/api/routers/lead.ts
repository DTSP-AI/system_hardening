import { z } from "zod";
import { zId, zName, zShort, zEmail, zPhone, zIdArray, zImportRows } from "@/lib/validation";
import { createTRPCRouter, authedProcedure, adminProcedure } from "@/server/api/trpc";
import { notify } from "@/lib/notify";
import { logAudit, toJsonSafe } from "@/lib/audit";

const leadInput = z.object({
  firstName: zName,
  lastName: zName,
  email: zEmail.optional(),
  phone: zPhone.optional(),
  companyName: zShort.optional(),
  jobTitle: zShort.optional(),
  source: zShort.optional(),
});

const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "UNQUALIFIED", "CONVERTED"] as const;

export const leadRouter = createTRPCRouter({
  list: authedProcedure.query(({ ctx }) =>
    ctx.db.lead.findMany({ orderBy: { createdAt: "desc" } }),
  ),

  byId: authedProcedure
    .input(z.object({ id: zId }))
    .query(({ ctx, input }) => ctx.db.lead.findUniqueOrThrow({ where: { id: input.id } })),

  create: authedProcedure
    .input(leadInput)
    .mutation(({ ctx, input }) => ctx.db.lead.create({ data: { ...input } })),

  update: authedProcedure
    .input(leadInput.partial().extend({ id: zId }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.lead.update({ where: { id }, data });
    }),

  setStatus: authedProcedure
    .input(z.object({ id: zId, status: z.enum(LEAD_STATUSES) }))
    .mutation(({ ctx, input }) =>
      ctx.db.lead.update({ where: { id: input.id }, data: { status: input.status } }),
    ),

  delete: adminProcedure
    .input(z.object({ id: zId }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db.lead.delete({ where: { id: input.id } });
      await logAudit(ctx.db, {
        actorId: ctx.userId,
        entityType: "LEAD",
        entityId: input.id,
        action: "DELETE",
        diff: toJsonSafe(deleted),
      });
      return deleted;
    }),

  deleteMany: adminProcedure
    .input(z.object({ ids: zIdArray }))
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.lead.findMany({ where: { id: { in: input.ids } } });
      const result = await ctx.db.lead.deleteMany({ where: { id: { in: input.ids } } });
      for (const row of rows) {
        await logAudit(ctx.db, {
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
    .input(z.object({ rows: zImportRows(leadInput) }))
    .mutation(({ ctx, input }) =>
      ctx.db.lead.createMany({
        data: input.rows.map((row) => ({ ...row })),
      }),
    ),

  convert: authedProcedure
    .input(z.object({ id: zId }))
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.db.lead.findUniqueOrThrow({ where: { id: input.id } });

      let companyId: string | undefined;
      if (lead.companyName) {
        const existing = await ctx.db.company.findFirst({ where: { name: lead.companyName } });
        companyId = existing
          ? existing.id
          : (
              await ctx.db.company.create({
                data: { name: lead.companyName },
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
        },
      });

      await ctx.db.lead.update({
        where: { id: lead.id },
        data: { status: "CONVERTED", convertedContactId: contact.id },
      });

      if (lead.ownerId && lead.ownerId !== ctx.userId) {
        await notify(ctx.db, {
          userId: lead.ownerId,
          type: "LEAD_CONVERTED",
          title: `${lead.firstName} ${lead.lastName} converted to a contact`,
          linkHref: `/contacts/${contact.id}`,
        });
      }

      return contact;
    }),
});
