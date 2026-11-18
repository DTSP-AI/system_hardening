import { z } from "zod";
import { zId, zLong } from "@/lib/validation";
import { createTRPCRouter, authedProcedure } from "@/server/api/trpc";

const activityInput = z.object({
  type: z.enum(["NOTE", "TASK", "CALL", "EMAIL", "MEETING"]),
  contactId: zId.optional(),
  dealId: zId.optional(),
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
    .mutation(({ ctx, input }) =>
      ctx.db.activity.update({
        where: { id: input.id },
        data: { completedAt: new Date() },
      }),
    ),

  delete: authedProcedure
    .input(z.object({ id: zId }))
    .mutation(({ ctx, input }) => ctx.db.activity.delete({ where: { id: input.id } })),
});
