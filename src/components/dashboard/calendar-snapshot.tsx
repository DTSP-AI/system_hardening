"use client";

import { trpc } from "@/lib/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";

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

  if (upcoming.isError) {
    return <p className="py-3 text-xs text-muted-foreground">Unable to load upcoming meetings.</p>;
  }

  const meetings = upcoming.data ?? [];

  if (meetings.length === 0) {
    const examples = [
      { title: "Discovery call", detail: "Alex Morgan · Example", time: "Mon · 9:30 AM" },
      { title: "Strategy review", detail: "Taylor Reed · Example", time: "Mon · 1:00 PM" },
      { title: "Team check-in", detail: "Jordan Lee · Example", time: "Tue · 10:00 AM" },
      { title: "Follow-up meeting", detail: "Casey Brooks · Example", time: "Wed · 2:30 PM" },
    ];
    return <div className="flex flex-col gap-1.5">
      <p className="pb-1 text-[11px] text-muted-foreground">Example meetings · No upcoming meetings scheduled</p>
      {examples.map((meeting) => <div key={meeting.title} className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-2 py-1.5">
        <div className="flex flex-col"><span className="text-xs font-medium text-card-foreground">{meeting.title}</span><span className="text-[11px] text-muted-foreground">{meeting.detail}</span></div>
        <span className="mono-num shrink-0 text-[11px] text-muted-foreground">{meeting.time}</span>
      </div>)}
    </div>;
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
