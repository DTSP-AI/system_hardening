"use client";

import { trpc } from "@/lib/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarClock } from "lucide-react";

export function CalendarSnapshot() {
  const upcoming = trpc.activity.upcoming.useQuery();

  if (upcoming.isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const meetings = upcoming.data ?? [];

  if (meetings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1.5 py-3 text-xs text-muted-foreground">
        <CalendarClock className="size-5" />
        No upcoming meetings
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {meetings.map((meeting) => {
        const who = meeting.contact
          ? `${meeting.contact.firstName} ${meeting.contact.lastName}`
          : (meeting.deal?.name ?? "Meeting");
        return (
          <div
            key={meeting.id}
            className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-2 py-1.5"
          >
            <div className="flex flex-col">
              <span className="text-xs font-medium text-card-foreground">{who}</span>
              {meeting.body && (
                <span className="text-[11px] text-muted-foreground line-clamp-1">
                  {meeting.body}
                </span>
              )}
            </div>
            <span className="mono-num shrink-0 text-[11px] text-muted-foreground">
              {meeting.dueDate &&
                new Date(meeting.dueDate).toLocaleString([], {
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
            </span>
          </div>
        );
      })}
    </div>
  );
}
