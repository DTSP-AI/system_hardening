import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "@/server/api/trpc";

export const notificationRouter = createTRPCRouter({
  list: tenantProcedure.query(({ ctx }) =>
    ctx.db.notification.findMany({
      where: { userId: ctx.userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ),

  unreadCount: tenantProcedure.query(async ({ ctx }) =>
    ctx.db.notification.count({ where: { userId: ctx.userId, readAt: null } }),
  ),

  markRead: tenantProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.notification.update({ where: { id: input.id }, data: { readAt: new Date() } }),
    ),

  markAllRead: tenantProcedure.mutation(({ ctx }) =>
    ctx.db.notification.updateMany({
      where: { userId: ctx.userId, readAt: null },
      data: { readAt: new Date() },
    }),
  ),
});
