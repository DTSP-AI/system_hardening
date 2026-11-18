import { Skeleton } from "@/components/ui/skeleton";
import type { RouterOutputs } from "@/lib/trpc/types";

type Stage = RouterOutputs["pipelineStage"]["list"][number];
type Deal = RouterOutputs["deal"]["list"][number];
const STAGE_COLORS = ["#1667bc", "#0791c4", "#27b4d1", "#4169a5", "#69c8dc"];
const RADIUS = 58;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function PipelineDonut({ stages, deals, isLoading }: {
  stages: Stage[] | undefined; deals: Deal[] | undefined; isLoading: boolean;
}) {
  if (isLoading) return <div className="flex items-center justify-center py-6"><Skeleton className="size-40 rounded-full" /></div>;
  const rows = (stages ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder).map((stage, i) => {
    const stageDeals = (deals ?? []).filter((d) => d.stageId === stage.id);
    return { stage, count: stageDeals.length, total: stageDeals.reduce((sum, d) => sum + (d.amount ? Number(d.amount) : 0), 0), color: STAGE_COLORS[i % STAGE_COLORS.length] };
  }).filter((r) => r.total > 0);
  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);
  if (rows.length === 0) return <div className="py-10 text-center text-sm text-muted-foreground">No deals yet.</div>;
  const segments = rows.map((row, i) => ({
    ...row,
    length: row.total / grandTotal * CIRCUMFERENCE,
    offset: rows.slice(0, i).reduce((sum, previous) => sum + previous.total / grandTotal * CIRCUMFERENCE, 0),
  }));
  return <div className="flex flex-col items-center gap-6 xl:flex-row xl:justify-center">
    <div className="relative size-44 shrink-0">
      <svg viewBox="0 0 140 140" className="size-full -rotate-90" role="img" aria-label={`Total pipeline value $${Math.round(grandTotal).toLocaleString()}`}>
        <circle cx="70" cy="70" r={RADIUS} fill="none" stroke="var(--muted)" strokeWidth="15" />
        {segments.map(({ stage, color, length, offset }) => <circle key={stage.id} cx="70" cy="70" r={RADIUS} fill="none" stroke={color} strokeWidth="15" strokeDasharray={`${Math.max(0, length - Math.min(3, length / 4))} ${CIRCUMFERENCE}`} strokeDashoffset={-offset} strokeLinecap="round" />)}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"><span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total value</span><span className="max-w-28 break-all text-lg font-bold tabular-nums text-card-foreground">${Math.round(grandTotal).toLocaleString()}</span></div>
    </div>
    <div className="w-full space-y-3 xl:max-w-52">{rows.map(({ stage, count, total, color }) => <div key={stage.id} className="flex items-center gap-2 text-sm"><span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} /><span className="min-w-0 flex-1 truncate font-medium text-card-foreground">{stage.name}<span className="block text-xs font-normal text-muted-foreground">{count} {count === 1 ? "deal" : "deals"}</span></span><span className="shrink-0 font-semibold tabular-nums text-card-foreground">{Math.round(total / grandTotal * 100)}%</span></div>)}</div>
  </div>;
}
