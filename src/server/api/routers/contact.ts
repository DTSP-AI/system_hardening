import { z } from "zod";
import { createTRPCRouter, authedProcedure, adminProcedure } from "@/server/api/trpc";
import { logAudit, toJsonSafe } from "@/lib/audit";

const CONTACT_TYPES = ["CUSTOMER", "VENDOR", "PARTNER"] as const;

const contactInput = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.email().optional(),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  companyId: z.string().optional(),
  leadSource: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  type: z.enum(CONTACT_TYPES).optional(),
  customFields: z.record(z.string(), z.any()).optional(),
});

export const contactRouter = createTRPCRouter({
  list: authedProcedure.query(({ ctx }) =>
    ctx.db.contact.findMany({
      include: { company: true },
      orderBy: { createdAt: "desc" },
    }),
  ),

  byId: authedProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) =>
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
    .input(contactInput.partial().extend({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.contact.update({ where: { id }, data });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
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
    .input(z.object({ ids: z.array(z.string()).min(1) }))
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
    .input(z.object({ rows: z.array(contactInput) }))
    .mutation(({ ctx, input }) =>
      ctx.db.contact.createMany({
        data: input.rows.map((row) => ({ ...row })),
      }),
    ),
});
