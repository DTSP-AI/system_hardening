import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { zId, zLong } from "@/lib/validation";
import { createTRPCRouter, authedProcedure } from "@/server/api/trpc";

/** Authors may change their own activities; OWNER/ADMIN may change any. */
function ownedBy(ctx: { userId: string; user: { role: string } }) {
  return ctx.user.role === "OWNER" || ctx.user.role === "ADMIN" ? {} : { authorId: ctx.userId };
}

const activityInput = z.object({
  type: z.enum(["NOTE", "TASK", "CALL", "EMAIL", "MEETING"]),
  contactId: zId.optional(),
  dealId: zId.optional(),
  accountId: zId.optional(),
  leadId: zId.optional(),
  body: zLong.optional(),
  dueDate: z.coerce.date().optional(),
});

export const activityRouter = createTRPCRouter({
  upcoming: authedProcedure.query(({ ctx }) =>
    ctx.db.activity.findMany({
      where: {
        authorId: ctx.userId,
        type: "MEETING",
        completedAt: null,
        dueDate: { gte: new Date() },
      },
      orderBy: { dueDate: "asc" },
      take: 6,
      include: {
        contact: { select: { firstName: true, lastName: true } },
        deal: { select: { name: true } },
      },
    }),
  ),

  myTasks: authedProcedure.query(({ ctx }) =>
    ctx.db.activity.findMany({
      where: { authorId: ctx.userId, type: "TASK" },
      orderBy: [{ completedAt: "desc" }, { dueDate: "asc" }],
      include: {
        contact: { select: { firstName: true, lastName: true } },
        deal: { select: { name: true } },
      },
    }),
  ),

  notifications: authedProcedure.query(async ({ ctx }) => {
    const [calls, emails] = await Promise.all([
      ctx.db.activity.findMany({
        where: { authorId: ctx.userId, type: "CALL" },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { contact: { select: { firstName: true, lastName: true } } },
      }),
      ctx.db.activity.findMany({
        where: { authorId: ctx.userId, type: "EMAIL" },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { contact: { select: { firstName: true, lastName: true } } },
      }),
    ]);

    const missedStatuses = new Set(["no-answer", "busy", "failed", "canceled"]);
    const missedCalls = calls
      .filter((call) => {
        const status = (call.metadata as { status?: string } | null)?.status;
        return status ? missedStatuses.has(status) : false;
      })
      .slice(0, 5);

    return { missedCalls, emails };
  }),

  create: authedProcedure
    .input(activityInput)
    .mutation(({ ctx, input }) =>
      ctx.db.activity.create({
        data: { ...input, authorId: ctx.userId },
      }),
    ),

  complete: authedProcedure
    .input(z.object({ id: zId }))
    .mutation(async ({ ctx, input }) => {
      const r = await ctx.db.activity.updateMany({
        where: { id: input.id, ...ownedBy(ctx) },
        data: { completedAt: new Date() },
      });
      if (r.count !== 1) throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
      return { id: input.id };
    }),

  delete: authedProcedure
    .input(z.object({ id: zId }))
    .mutation(async ({ ctx, input }) => {
      const r = await ctx.db.activity.deleteMany({ where: { id: input.id, ...ownedBy(ctx) } });
      if (r.count !== 1) throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
      return { id: input.id };
    }),
});
