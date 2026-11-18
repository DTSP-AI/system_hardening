import { z } from "zod";
import { createTRPCRouter, tenantProcedure, adminProcedure } from "@/server/api/trpc";
import { notify } from "@/lib/notify";

const SERVICE_ISSUE_TYPES = [
  "PERFORMANCE",
  "EQUIPMENT_FAILURE",
  "ROOF_LEAK",
  "MONITORING",
  "BILLING",
  "WARRANTY",
  "OTHER",
] as const;

const SERVICE_TICKET_STATUSES = ["OPEN", "SCHEDULED", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

const serviceTicketInput = z.object({
  projectId: z.string(),
  ticketNumber: z.string().min(1),
  issueType: z.enum(SERVICE_ISSUE_TYPES).optional(),
  description: z.string().optional(),
  reportedAt: z.coerce.date().optional(),
  technicianName: z.string().optional(),
  technicianPhone: z.string().optional(),
  costAmount: z.number().nonnegative().optional(),
  warrantyCovered: z.boolean().optional(),
});

export const serviceTicketRouter = createTRPCRouter({
  list: tenantProcedure
    .input(
      z.object({
        projectId: z.string().optional(),
        status: z.enum(SERVICE_TICKET_STATUSES).optional(),
      }).optional(),
    )
    .query(({ ctx, input }) =>
      ctx.db.serviceTicket.findMany({
        where: { projectId: input?.projectId, status: input?.status },
        include: { project: { include: { contact: true, company: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ),

  byId: tenantProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) =>
    ctx.db.serviceTicket.findUniqueOrThrow({
      where: { id: input.id },
      include: { project: { include: { contact: true, company: true } } },
    }),
  ),

  create: tenantProcedure
    .input(serviceTicketInput)
    .mutation(({ ctx, input }) =>
      ctx.db.serviceTicket.create({ data: { ...input, tenantId: ctx.tenantId } }),
    ),

  update: tenantProcedure
    .input(serviceTicketInput.partial().extend({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.serviceTicket.update({ where: { id }, data });
    }),

  setStatus: tenantProcedure
    .input(z.object({ id: z.string(), status: z.enum(SERVICE_TICKET_STATUSES) }))
    .mutation(async ({ ctx, input }) => {
      const ticket = await ctx.db.serviceTicket.update({
        where: { id: input.id },
        data: {
          status: input.status,
          resolvedAt: input.status === "RESOLVED" || input.status === "CLOSED" ? new Date() : null,
        },
        include: { project: true },
      });

      if (ticket.project.ownerId && ticket.project.ownerId !== ctx.userId) {
        await notify(ctx.db, ctx.tenantId, {
          userId: ticket.project.ownerId,
          type: "SERVICE_TICKET_STATUS_CHANGE",
          title: `Service ticket ${ticket.ticketNumber} moved to ${input.status}`,
          linkHref: `/projects/${ticket.projectId}`,
        });
      }

      return ticket;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.db.serviceTicket.delete({ where: { id: input.id } })),
});
