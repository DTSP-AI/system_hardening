"use client";

import { Mail, CalendarClock, CheckSquare, StickyNote, PhoneCall, PhoneMissed } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";

type ActivityRow = {
  id: string;
  type: "NOTE" | "TASK" | "CALL" | "EMAIL" | "MEETING";
  body: string | null;
  createdAt: Date | string;
  metadata?: unknown;
  contact: { firstName: string; lastName: string } | null;
  deal: { name: string } | null;
};

const TYPE_LABEL: Record<ActivityRow["type"], string> = {
  NOTE: "Note",
  TASK: "Task",
  CALL: "Call",
  EMAIL: "Email",
  MEETING: "Meeting",
};

function relativeTime(date: Date | string): string {
  const ms = Date.now() - new Date(date).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const days = Math.floor(hr / 24);
  return `${days}d`;
}

function ActivityRowIcon({ row }: { row: ActivityRow }) {
  if (row.type === "CALL") {
    const status = (row.metadata as { status?: string } | null)?.status;
    const connected = status === "completed" || status === "in-progress";
    const Icon = connected ? PhoneCall : PhoneMissed;
    return (
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-full"
        style={{
          backgroundColor: connected
            ? "color-mix(in oklab, var(--good) 16%, transparent)"
            : "color-mix(in oklab, var(--warn) 16%, transparent)",
          color: connected ? "var(--good)" : "var(--warn)",
        }}
      >
        <Icon className="size-3.5" />
      </span>
    );
  }
  const Icon =
    row.type === "EMAIL" ? Mail : row.type === "MEETING" ? CalendarClock : row.type === "TASK" ? CheckSquare : StickyNote;
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
      <Icon className="size-3.5" />
    </span>
  );
}

export function ActivityFeed() {
  const activity = trpc.dashboard.recentActivity.useQuery();

  if (activity.isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    );
  }

  const rows = (activity.data ?? []) as ActivityRow[];

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      {rows.map((row) => {
        const linked = row.contact ? `${row.contact.firstName} ${row.contact.lastName}` : (row.deal?.name ?? null);
        return (
          <div key={row.id} className="flex items-center gap-3 rounded-md px-1 py-1.5">
            <ActivityRowIcon row={row} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-card-foreground">
                {TYPE_LABEL[row.type]}
                {linked ? ` — ${linked}` : ""}
              </p>
              {row.body && (
                <p className="truncate text-xs text-muted-foreground">{row.body}</p>
              )}
            </div>
            <span className="mono-num shrink-0 text-xs text-muted-foreground">
              {relativeTime(row.createdAt)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
