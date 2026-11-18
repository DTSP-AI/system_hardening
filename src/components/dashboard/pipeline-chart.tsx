"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";

const WIDTH = 640;
const HEIGHT = 200;
const PAD_LEFT = 44;
const PAD_RIGHT = 12;
const PAD_TOP = 14;
const BASELINE = 158;

function niceMax(value: number): number {
  if (value <= 0) return 1000;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function formatTick(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `$${Math.round(value / 1000)}K`;
  return `$${value}`;
}

export function PipelineChart() {
  const weekly = trpc.dashboard.pipelineWeekly.useQuery();
  const [hovered, setHovered] = useState<number | null>(null);

  if (weekly.isLoading) {
    return <Skeleton className="h-[220px] w-full" />;
  }

  const data = weekly.data ?? [];
  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        No pipeline activity yet.
      </div>
    );
  }

  const rawMax = Math.max(...data.map((d) => d.value));
  const maxTick = niceMax(rawMax || 1);
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = BASELINE - PAD_TOP;
  const step = data.length > 1 ? plotWidth / (data.length - 1) : 0;

  const points = data.map((d, i) => ({
    x: PAD_LEFT + step * i,
    y: BASELINE - (d.value / maxTick) * plotHeight,
    ...d,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x},${BASELINE} L${points[0].x},${BASELINE} Z`;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => maxTick * f);
  const last = points[points.length - 1];
  const active = hovered !== null ? points[hovered] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        onMouseLeave={() => setHovered(null)}
      >
        <defs>
          <linearGradient id="pipelineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {ticks.map((t) => {
          const y = BASELINE - (t / maxTick) * plotHeight;
          return (
            <g key={t}>
              <line
                x1={PAD_LEFT}
                x2={WIDTH - PAD_RIGHT}
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <text x={PAD_LEFT - 8} y={y + 3} textAnchor="end" className="mono-num fill-muted-foreground text-[9px]">
                {formatTick(t)}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill="url(#pipelineFill)" />
        <path d={linePath} fill="none" stroke="var(--chart-1)" strokeWidth={2} strokeLinecap="round" />

        {points.map((p, i) => (
          <text
            key={p.weekLabel}
            x={p.x}
            y={HEIGHT - 4}
            textAnchor="middle"
            className="fill-muted-foreground text-[9px]"
          >
            {i % 2 === 0 || data.length <= 5 ? p.weekLabel : ""}
          </text>
        ))}

        <circle cx={last.x} cy={last.y} r={4} fill="var(--chart-1)" />
        <text
          x={Math.min(last.x, WIDTH - PAD_RIGHT - 44)}
          y={last.y - 10}
          textAnchor="middle"
          className="mono-num fill-card-foreground text-[10px] font-semibold"
        >
          {formatTick(last.value)}
        </text>

        {active && (
          <line
            x1={active.x}
            x2={active.x}
            y1={PAD_TOP}
            y2={BASELINE}
            stroke="var(--muted-foreground)"
            strokeWidth={1}
            strokeDasharray="3,3"
          />
        )}

        {points.map((p, i) => (
          <rect
            key={p.weekLabel}
            x={p.x - step / 2}
            y={PAD_TOP}
            width={step || plotWidth}
            height={plotHeight}
            fill="transparent"
            onMouseEnter={() => setHovered(i)}
          />
        ))}
      </svg>

      {active && (
        <div
          className="pointer-events-none absolute top-1 flex flex-col gap-0.5 rounded-md border border-border bg-popover px-2 py-1.5 text-xs shadow-md"
          style={{
            left: `${(active.x / WIDTH) * 100}%`,
            transform:
              hovered === 0
                ? "translateX(0%)"
                : hovered === points.length - 1
                  ? "translateX(-100%)"
                  : "translateX(-50%)",
          }}
        >
          <span className="text-[10px] text-muted-foreground">{active.weekLabel}</span>
          <span className="mono-num font-semibold text-popover-foreground">
            {formatTick(active.value)}
          </span>
        </div>
      )}
    </div>
  );
}
