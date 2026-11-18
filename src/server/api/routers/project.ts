import { z } from "zod";
import { createTRPCRouter, tenantProcedure, adminProcedure } from "@/server/api/trpc";
import { notify } from "@/lib/notify";
import { logAudit, toJsonSafe } from "@/lib/audit";

const PROJECT_STATUSES = [
  "SOLD",
  "SITE_SURVEY",
  "DESIGN",
  "PERMITTING",
  "SCHEDULED",
  "INSTALLING",
  "INSTALLED",
  "INSPECTION",
  "UTILITY_PTO",
  "COMPLETE",
  "CANCELLED",
] as const;

const FINANCING_TYPES = ["CASH", "LOAN", "LEASE", "PPA"] as const;

const projectInput = z.object({
  projectNumber: z.string().min(1),
  financingType: z.enum(FINANCING_TYPES).optional(),
  systemSizeKw: z.number().positive(),
  panelCount: z.number().int().positive(),
  contractAmount: z.number().nonnegative(),
  panelVendorId: z.string().optional(),
  inverterVendorId: z.string().optional(),
  installAddressLine1: z.string().optional(),
  installAddressLine2: z.string().optional(),
  installCity: z.string().optional(),
  installState: z.string().optional(),
  installPostalCode: z.string().optional(),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  ownerId: z.string().optional(),
  soldDate: z.coerce.date().optional(),
  siteSurveyDate: z.coerce.date().optional(),
  permitSubmittedDate: z.coerce.date().optional(),
  permitApprovedDate: z.coerce.date().optional(),
  installStartDate: z.coerce.date().optional(),
  installCompleteDate: z.coerce.date().optional(),
  inspectionDate: z.coerce.date().optional(),
  ptoDate: z.coerce.date().optional(),
  customFields: z.record(z.string(), z.any()).optional(),
});

export const projectRouter = createTRPCRouter({
  list: tenantProcedure
    .input(
      z.object({
        status: z.enum(PROJECT_STATUSES).optional(),
        financingType: z.enum(FINANCING_TYPES).optional(),
      }).optional(),
    )
    .query(({ ctx, input }) =>
      ctx.db.project.findMany({
        where: {
          status: input?.status,
          financingType: input?.financingType,
        },
        include: { panelVendor: true, inverterVendor: true, contact: true, company: true },
        orderBy: { createdAt: "desc" },
      }),
    ),

  byId: tenantProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) =>
    ctx.db.project.findUniqueOrThrow({
      where: { id: input.id },
      include: {
        panelVendor: true,
        inverterVendor: true,
        contact: true,
        company: true,
        commissions: { orderBy: { createdAt: "desc" } },
        serviceTickets: { orderBy: { createdAt: "desc" } },
        activities: { orderBy: { createdAt: "desc" } },
      },
    }),
  ),

  create: tenantProcedure
    .input(projectInput)
    .mutation(({ ctx, input }) =>
      ctx.db.project.create({ data: { ...input, tenantId: ctx.tenantId } }),
    ),

  update: tenantProcedure
    .input(projectInput.partial().extend({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.project.update({ where: { id }, data });
    }),

  setStatus: tenantProcedure
    .input(z.object({ id: z.string(), status: z.enum(PROJECT_STATUSES) }))
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.db.project.update({
        where: { id: input.id },
        data: { status: input.status },
      });

      if (project.ownerId && project.ownerId !== ctx.userId) {
        await notify(ctx.db, ctx.tenantId, {
          userId: project.ownerId,
          type: "PROJECT_STATUS_CHANGE",
          title: `Project ${project.projectNumber} moved to ${input.status}`,
          linkHref: `/projects/${project.id}`,
        });
      }

      return project;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db.project.delete({ where: { id: input.id } });
      await logAudit(ctx.db, ctx.tenantId, {
        actorId: ctx.userId,
        entityType: "PROJECT",
        entityId: input.id,
        action: "DELETE",
        diff: toJsonSafe(deleted),
      });
      return deleted;
    }),

  deleteMany: adminProcedure
    .input(z.object({ ids: z.array(z.string()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.project.findMany({ where: { id: { in: input.ids } } });
      const result = await ctx.db.project.deleteMany({ where: { id: { in: input.ids } } });
      for (const row of rows) {
        await logAudit(ctx.db, ctx.tenantId, {
          actorId: ctx.userId,
          entityType: "PROJECT",
          entityId: row.id,
          action: "DELETE",
          diff: toJsonSafe(row),
        });
      }
      return result;
    }),
});
