import { z } from "zod";
import { createTRPCRouter, tenantProcedure, adminProcedure } from "@/server/api/trpc";

const VENDOR_TYPES = [
  "PANEL_MANUFACTURER",
  "INVERTER_MANUFACTURER",
  "BATTERY_MANUFACTURER",
  "RACKING_MANUFACTURER",
  "DISTRIBUTOR",
  "OTHER",
] as const;

const vendorInput = z.object({
  name: z.string().min(1),
  type: z.enum(VENDOR_TYPES).optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  portalUrl: z.string().optional(),
  notes: z.string().optional(),
});

export const vendorRouter = createTRPCRouter({
  list: tenantProcedure
    .input(z.object({ type: z.enum(VENDOR_TYPES).optional() }).optional())
    .query(({ ctx, input }) =>
      ctx.db.vendor.findMany({
        where: { type: input?.type },
        orderBy: { name: "asc" },
      }),
    ),

  byId: tenantProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) =>
    ctx.db.vendor.findUniqueOrThrow({
      where: { id: input.id },
      include: { panelProjects: true, inverterProjects: true },
    }),
  ),

  create: tenantProcedure
    .input(vendorInput)
    .mutation(({ ctx, input }) =>
      ctx.db.vendor.create({ data: { ...input, tenantId: ctx.tenantId } }),
    ),

  update: tenantProcedure
    .input(vendorInput.partial().extend({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.vendor.update({ where: { id }, data });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.db.vendor.delete({ where: { id: input.id } })),
});
