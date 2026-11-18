import { createTRPCRouter, tenantProcedure } from "@/server/api/trpc";

const STALE_MS = 14 * 24 * 60 * 60 * 1000;
const CONNECTED_STATUSES = new Set(["completed", "in-progress"]);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const PIPELINE_WEEKS = 8;

export const dashboardRouter = createTRPCRouter({
  summary: tenantProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - WEEK_MS);
    const staleThreshold = new Date(now.getTime() - STALE_MS);

    const [openDeals, callsToday] = await Promise.all([
      ctx.db.deal.findMany({
        where: { status: "OPEN" },
        select: { amount: true, createdAt: true, updatedAt: true },
      }),
      ctx.db.activity.findMany({
        where: { type: "CALL", createdAt: { gte: startOfToday } },
        select: { metadata: true },
      }),
    ]);

    const openPipelineValue = openDeals.reduce((sum, deal) => sum + Number(deal.amount ?? 0), 0);
    const recentDealCount = openDeals.filter((deal) => deal.createdAt >= sevenDaysAgo).length;
    const staleDealCount = openDeals.filter((deal) => deal.updatedAt < staleThreshold).length;
    const callsConnectedToday = callsToday.filter((call) => {
      const status = (call.metadata as { status?: string } | null)?.status;
      return status ? CONNECTED_STATUSES.has(status) : false;
    }).length;

    return {
      openPipelineValue,
      openDealCount: openDeals.length,
      recentDealCount,
      staleDealCount,
      callsToday: callsToday.length,
      callsConnectedToday,
    };
  }),

  pipelineWeekly: tenantProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const start = new Date(now.getTime() - PIPELINE_WEEKS * WEEK_MS);

    const deals = await ctx.db.deal.findMany({
      where: { createdAt: { gte: start } },
      select: { amount: true, createdAt: true },
    });

    const buckets = Array.from({ length: PIPELINE_WEEKS }, (_, i) => ({
      weekStart: new Date(start.getTime() + i * WEEK_MS),
      value: 0,
    }));

    for (const deal of deals) {
      const offsetMs = deal.createdAt.getTime() - start.getTime();
      const idx = Math.min(PIPELINE_WEEKS - 1, Math.max(0, Math.floor(offsetMs / WEEK_MS)));
      buckets[idx].value += Number(deal.amount ?? 0);
    }

    return buckets.map((bucket) => ({
      weekLabel: bucket.weekStart
        .toLocaleDateString("en-US", { month: "short", day: "2-digit" })
        .toUpperCase(),
      value: bucket.value,
    }));
  }),

  recentActivity: tenantProcedure.query(({ ctx }) =>
    ctx.db.activity.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        contact: { select: { firstName: true, lastName: true } },
        deal: { select: { name: true } },
      },
    }),
  ),
});
