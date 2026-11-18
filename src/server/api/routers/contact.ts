import { z } from "zod";
import { zId, zName, zShort, zEmail, zPhone, zIdArray, zCustomFields, zImportRows } from "@/lib/validation";
import { createTRPCRouter, authedProcedure, adminProcedure } from "@/server/api/trpc";
import { logAudit, toJsonSafe } from "@/lib/audit";

const CONTACT_TYPES = ["CUSTOMER", "VENDOR", "PARTNER"] as const;

const contactInput = z.object({
  firstName: zName,
  lastName: zName,
  email: zEmail.optional(),
  phone: zPhone.optional(),
  jobTitle: zShort.optional(),
  companyId: zId.optional(),
  leadSource: zShort.optional(),
  addressLine1: zShort.optional(),
  addressLine2: zShort.optional(),
  city: zShort.optional(),
  state: zShort.optional(),
  postalCode: zShort.optional(),
  country: zShort.optional(),
  type: z.enum(CONTACT_TYPES).optional(),
  customFields: zCustomFields.optional(),
});

export const contactRouter = createTRPCRouter({
  list: authedProcedure.query(({ ctx }) =>
    ctx.db.contact.findMany({
      include: { company: true },
      orderBy: { createdAt: "desc" },
    }),
  ),

  byId: authedProcedure.input(z.object({ id: zId })).query(({ ctx, input }) =>
    ctx.db.contact.findUniqueOrThrow({
      where: { id: input.id },
      include: {
        company: true,
        deals: { include: { stage: true } },
        activities: { orderBy: { createdAt: "desc" } },
      },
    }),
  ),

  create: authedProcedure
    .input(contactInput)
    .mutation(({ ctx, input }) =>
      ctx.db.contact.create({ data: { ...input } }),
    ),

  update: authedProcedure
    .input(contactInput.partial().extend({ id: zId }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.contact.update({ where: { id }, data });
    }),

  delete: adminProcedure
    .input(z.object({ id: zId }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db.contact.delete({ where: { id: input.id } });
      await logAudit(ctx.db, {
        actorId: ctx.userId,
        entityType: "CONTACT",
        entityId: input.id,
        action: "DELETE",
        diff: toJsonSafe(deleted),
      });
      return deleted;
    }),

  deleteMany: adminProcedure
    .input(z.object({ ids: zIdArray }))
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.contact.findMany({ where: { id: { in: input.ids } } });
      const result = await ctx.db.contact.deleteMany({ where: { id: { in: input.ids } } });
      for (const row of rows) {
        await logAudit(ctx.db, {
          actorId: ctx.userId,
          entityType: "CONTACT",
          entityId: row.id,
          action: "DELETE",
          diff: toJsonSafe(row),
        });
      }
      return result;
    }),

  bulkCreate: adminProcedure
    .input(z.object({ rows: zImportRows(contactInput) }))
    .mutation(({ ctx, input }) =>
      ctx.db.contact.createMany({
        data: input.rows.map((row) => ({ ...row })),
      }),
    ),
});
