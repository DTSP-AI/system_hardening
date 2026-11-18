import { createTRPCRouter, adminProcedure } from "@/server/api/trpc";

export const auditLogRouter = createTRPCRouter({
  list: adminProcedure.query(({ ctx }) =>
    ctx.db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ),
});
