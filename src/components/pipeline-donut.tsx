import { Skeleton } from "@/components/ui/skeleton";
import type { RouterOutputs } from "@/lib/trpc/types";

type Stage = RouterOutputs["pipelineStage"]["list"][number];
type Deal = RouterOutputs["deal"]["list"][number];

/** Fixed categorical order (CVD-validated) -- same assignment as PipelineFunnel. */
const STAGE_COLORS = [
  "var(--viz-blue)",
  "var(--viz-aqua)",
  "var(--viz-yellow)",
  "var(--viz-violet)",
  "var(--viz-orange)",
];

const RADIUS = 60;
const STROKE = 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP_PX = 4;

export function PipelineDonut({
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
      <div className="flex items-center justify-center py-6">
        <Skeleton className="size-36 rounded-full" />
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
    })
    .filter((r) => r.total > 0);

  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);

  if (rows.length === 0) {
    return <div className="py-10 text-center text-sm text-muted-foreground">No deals yet.</div>;
  }

  const offsets = rows.reduce<number[]>((acc, r, i) => {
    const prev = i === 0 ? 0 : acc[i - 1] + (r.total / grandTotal) * CIRCUMFERENCE;
    return [...acc, prev];
  }, []);

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-center">
      <svg viewBox="0 0 140 140" className="size-40 shrink-0 -rotate-90">
        <circle
          cx="70"
          cy="70"
          r={RADIUS}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={STROKE}
        />
        {rows.map(({ stage, total }, i) => {
          const fraction = total / grandTotal;
          const segmentLength = fraction * CIRCUMFERENCE;
          const dashArray = `${Math.max(0, segmentLength - GAP_PX)} ${CIRCUMFERENCE - segmentLength + GAP_PX}`;
          const dashOffset = -offsets[i];
          return (
            <circle
              key={stage.id}
              cx="70"
              cy="70"
              r={RADIUS}
              fill="none"
              stroke={STAGE_COLORS[i % STAGE_COLORS.length]}
              strokeWidth={STROKE}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
            />
          );
        })}
        <text
          x="70"
          y="70"
          textAnchor="middle"
          dominantBaseline="central"
          className="rotate-90 fill-card-foreground text-[18px] font-bold"
          style={{ transformOrigin: "70px 70px" }}
        >
          ${Math.round(grandTotal).toLocaleString()}
        </text>
      </svg>
      <div className="flex flex-col gap-2">
        {rows.map(({ stage, count, total }, i) => (
          <div key={stage.id} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: STAGE_COLORS[i % STAGE_COLORS.length] }}
            />
            <span className="text-card-foreground">{stage.name}</span>
            <span className="text-muted-foreground">
              · {Math.round((total / grandTotal) * 100)}% · {count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
