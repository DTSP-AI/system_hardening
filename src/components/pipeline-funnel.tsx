import { Skeleton } from "@/components/ui/skeleton";
import type { RouterOutputs } from "@/lib/trpc/types";

type Stage = RouterOutputs["pipelineStage"]["list"][number];
type Deal = RouterOutputs["deal"]["list"][number];

const STAGE_COLORS = ["#1667bc", "#0791c4", "#27b4d1", "#4169a5", "#69c8dc"];

export function PipelineFunnel({ stages, deals, isLoading }: {
  stages: Stage[] | undefined; deals: Deal[] | undefined; isLoading: boolean;
}) {
  if (isLoading) return <div className="flex flex-col gap-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;

  const rows = (stages ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder).map((stage, i) => {
    const stageDeals = (deals ?? []).filter((d) => d.stageId === stage.id);
    return { stage, count: stageDeals.length, total: stageDeals.reduce((sum, d) => sum + (d.amount ? Number(d.amount) : 0), 0), color: STAGE_COLORS[i % STAGE_COLORS.length] };
  });
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));
  if (rows.every((r) => r.count === 0)) return <div className="py-10 text-center text-sm text-muted-foreground">No deals yet.</div>;

  return <div className="flex flex-col gap-5">
    {rows.map(({ stage, count, total, color }) => <div key={stage.id}>
      <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
        <span className="flex min-w-0 items-center gap-2 font-medium text-card-foreground"><span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} /><span className="truncate">{stage.name}</span></span>
        <span className="shrink-0 tabular-nums font-semibold text-card-foreground">${total.toLocaleString()} <span className="font-normal text-muted-foreground">· {count} {count === 1 ? "deal" : "deals"}</span></span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full transition-[width]" style={{ width: `${total > 0 ? Math.max(3, (total / maxTotal) * 100) : 0}%`, background: `linear-gradient(90deg, ${color}, #48c9e5)` }} /></div>
    </div>)}
  </div>;
}
