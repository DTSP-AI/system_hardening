import { z } from "zod";
import { createTRPCRouter, tenantProcedure, adminProcedure } from "@/server/api/trpc";

const carrierInput = z.object({
  name: z.string().min(1),
  naicCode: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  portalUrl: z.string().optional(),
  notes: z.string().optional(),
});

export const carrierRouter = createTRPCRouter({
  list: tenantProcedure.query(({ ctx }) =>
    ctx.db.carrier.findMany({
      orderBy: { name: "asc" },
    }),
  ),

  byId: tenantProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) =>
    ctx.db.carrier.findUniqueOrThrow({
      where: { id: input.id },
      include: { policies: true },
    }),
  ),

  create: tenantProcedure
    .input(carrierInput)
    .mutation(({ ctx, input }) =>
      ctx.db.carrier.create({ data: { ...input, tenantId: ctx.tenantId } }),
    ),

  update: tenantProcedure
    .input(carrierInput.partial().extend({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.carrier.update({ where: { id }, data });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.db.carrier.delete({ where: { id: input.id } })),
});
