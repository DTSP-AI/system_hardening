"use client";

import { trpc } from "@/lib/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1000)}K`;
  return `$${value.toLocaleString()}`;
}

function Tile({
  label,
  value,
  detail,
  warn,
}: {
  label: string;
  value: string;
  detail: string;
  warn?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card px-4 py-3.5">
      <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span
        className={`mono-num text-2xl font-semibold ${warn ? "text-(--warn)" : "text-card-foreground"}`}
      >
        {value}
      </span>
      <span className="text-[11px] text-muted-foreground">{detail}</span>
    </div>
  );
}

export function KpiTiles() {
  const summary = trpc.dashboard.summary.useQuery();

  if (summary.isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[86px] w-full" />
        ))}
      </div>
    );
  }

  if (!summary.data) return null;

  const { openPipelineValue, openDealCount, recentDealCount, staleDealCount, callsToday, callsConnectedToday } =
    summary.data;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile
        label="Open Pipeline"
        value={formatCurrency(openPipelineValue)}
        detail={`${recentDealCount} added this week`}
      />
      <Tile label="Open Deals" value={String(openDealCount)} detail="in active pipeline" />
      <Tile
        label="Calls Today"
        value={String(callsToday)}
        detail={`${callsConnectedToday} connected`}
      />
      <Tile
        label="Stale Deals"
        value={String(staleDealCount)}
        detail="14+ days untouched"
        warn={staleDealCount > 0}
      />
    </div>
  );
}
