import { Skeleton } from "@/components/ui/skeleton";
import type { RouterOutputs } from "@/lib/trpc/types";

type Stage = RouterOutputs["pipelineStage"]["list"][number];
type Deal = RouterOutputs["deal"]["list"][number];

/** Fixed categorical order (CVD-validated) -- assigned by stage rank, never cycled arbitrarily. */
const STAGE_COLORS = [
  "var(--viz-blue)",
  "var(--viz-aqua)",
  "var(--viz-yellow)",
  "var(--viz-violet)",
  "var(--viz-orange)",
];

export function PipelineFunnel({
  stages,
  deals,
  isLoading,
}: {
  stages: Stage[] | undefined;
  deals: Deal[] | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    );
  }

  const rows = (stages ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((stage) => {
      const stageDeals = (deals ?? []).filter((d) => d.stageId === stage.id);
      const total = stageDeals.reduce((sum, d) => sum + (d.amount ? Number(d.amount) : 0), 0);
      return { stage, count: stageDeals.length, total };
    });

  const maxTotal = Math.max(1, ...rows.map((r) => r.total));

  if (rows.every((r) => r.count === 0)) {
    return <div className="py-10 text-center text-sm text-muted-foreground">No deals yet.</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map(({ stage, count, total }, i) => {
        const widthPct = total > 0 ? Math.max(3, (total / maxTotal) * 100) : 0;
        const color = STAGE_COLORS[i % STAGE_COLORS.length];
        return (
          <div key={stage.id} className="flex items-center gap-3">
            <span className="flex w-28 shrink-0 items-center gap-1.5 truncate text-sm text-muted-foreground">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              {stage.name}
            </span>
            <div className="relative h-5 flex-1 rounded-sm bg-muted">
              <div
                className="h-5 rounded-r-[4px] transition-[width]"
                style={{ width: `${widthPct}%`, backgroundColor: color }}
              />
            </div>
            <span className="w-36 shrink-0 text-right text-sm tabular-nums text-card-foreground">
              ${total.toLocaleString()}{" "}
              <span className="text-muted-foreground">· {count}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
