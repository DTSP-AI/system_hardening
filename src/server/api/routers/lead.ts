import { z } from "zod";
import { zId, zName, zShort, zEmail, zPhone, zIdArray, zImportRows } from "@/lib/validation";
import { createTRPCRouter, authedProcedure, adminProcedure } from "@/server/api/trpc";
import { convertLead, setLeadStatus } from "@/server/services/lead-convert";
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
    .mutation(({ ctx, input }) =>
      setLeadStatus(ctx.db, { actorId: ctx.userId, leadId: input.id, status: input.status }),
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
    .mutation(({ ctx, input }) => convertLead(ctx.db, { actorId: ctx.userId, leadId: input.id })),
});
