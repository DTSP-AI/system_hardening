"use client";

import { trpc } from "@/lib/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";
import { CircleDollarSign, BriefcaseBusiness, PhoneCall, Clock3 } from "lucide-react";

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
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  warn?: boolean;
  icon: typeof CircleDollarSign;
}) {
  return (
    <div className="kpi-card"><div className="kpi-icon"><Icon size={22}/></div><div className="kpi-copy"><span className="kpi-label">{label}</span><strong className={warn ? "text-(--warn)" : ""}>{value}</strong><span className="kpi-detail">{detail}</span></div></div>
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
        icon={CircleDollarSign}
        label="Open Pipeline"
        value={formatCurrency(openPipelineValue)}
        detail={`${recentDealCount} added this week`}
      />
      <Tile icon={BriefcaseBusiness} label="Open Deals" value={String(openDealCount)} detail="in active pipeline" />
      <Tile
        icon={PhoneCall}
        label="Calls Today"
        value={String(callsToday)}
        detail={`${callsConnectedToday} connected`}
      />
      <Tile
        icon={Clock3}
        label="Stale Deals"
        value={String(staleDealCount)}
        detail="14+ days untouched"
        warn={staleDealCount > 0}
      />
    </div>
  );
}
