import { TRPCError } from "@trpc/server";
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
    .query(async ({ ctx, input }) => {
      const lead = await ctx.db.lead.findUniqueOrThrow({ where: { id: input.id } });
      // The record's journey: this lead's own activity plus everything logged on the
      // deal/contact it converted into.
      const activities = await ctx.db.activity.findMany({
        where: {
          OR: [
            { leadId: lead.id },
            ...(lead.convertedDealId ? [{ dealId: lead.convertedDealId }] : []),
            ...(lead.convertedContactId ? [{ contactId: lead.convertedContactId }] : []),
          ],
        },
        orderBy: { createdAt: "desc" },
      });
      return { ...lead, activities };
    }),

  create: authedProcedure
    .input(leadInput)
    .mutation(async ({ ctx, input }) => {
      const created = await ctx.db.lead.create({ data: { ...input } });
      await logAudit(ctx.db, {
        actorId: ctx.userId,
        entityType: "LEAD",
        entityId: created.id,
        action: "CREATE",
        diff: toJsonSafe(created),
      });
      return created;
    }),

  update: authedProcedure
    .input(leadInput.partial().extend({ id: zId }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const updated = await ctx.db.lead.update({ where: { id }, data });
      await logAudit(ctx.db, {
        actorId: ctx.userId,
        entityType: "LEAD",
        entityId: id,
        action: "UPDATE",
        diff: toJsonSafe(data),
      });
      return updated;
    }),

  setStatus: authedProcedure
    .input(z.object({ id: zId, status: z.enum(LEAD_STATUSES) }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.lead.update({
        where: { id: input.id },
        data: { status: input.status },
      });
      await logAudit(ctx.db, {
        actorId: ctx.userId,
        entityType: "LEAD",
        entityId: input.id,
        action: "UPDATE",
        diff: { status: input.status },
      });
      return updated;
    }),

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

      const firstStage = await ctx.db.pipelineStage.findFirst({
        where: { isWon: false, isLost: false },
        orderBy: { sortOrder: "asc" },
      });
      if (!firstStage) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No open pipeline stage exists to create the deal in" });
      }
      const deal = await ctx.db.deal.create({
        data: {
          name: lead.companyName ?? `${lead.firstName} ${lead.lastName}`,
          contactId: contact.id,
          companyId,
          stageId: firstStage.id,
          source: lead.source,
          ownerId: lead.ownerId,
        },
      });

      await ctx.db.lead.update({
        where: { id: lead.id },
        data: { status: "CONVERTED", convertedContactId: contact.id, convertedDealId: deal.id },
      });

      if (lead.ownerId && lead.ownerId !== ctx.userId) {
        await notify(ctx.db, {
          userId: lead.ownerId,
          type: "LEAD_CONVERTED",
          title: `${lead.firstName} ${lead.lastName} converted to a deal`,
          linkHref: `/deals/${deal.id}`,
        });
      }

      return { contact, deal };
    }),
});
