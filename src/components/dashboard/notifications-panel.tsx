"use client";

import { trpc } from "@/lib/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";
import { PhoneMissed, MessageSquare, Mail } from "lucide-react";

function Section({
  title,
  Icon,
  children,
}: {
  title: string;
  Icon: typeof PhoneMissed;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        <Icon className="size-3" />
        {title}
      </div>
      {children}
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="px-1 text-xs text-muted-foreground">{children}</p>;
}

export function NotificationsPanel() {
  const notifications = trpc.activity.notifications.useQuery();

  if (notifications.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const missedCalls = notifications.data?.missedCalls ?? [];
  const emails = notifications.data?.emails ?? [];

  return (
    <div className="flex flex-col gap-3">
      <Section title="Missed Calls" Icon={PhoneMissed}>
        {missedCalls.length === 0 ? (
          <EmptyRow>No missed calls</EmptyRow>
        ) : (
          missedCalls.map((call) => (
            <div
              key={call.id}
              className="flex items-center justify-between gap-2 border-l-2 py-0.5 pr-1 pl-2 text-xs"
              style={{ borderColor: "var(--warn)" }}
            >
              <span className="truncate text-card-foreground">
                {call.contact ? `${call.contact.firstName} ${call.contact.lastName}` : "Unknown"}
              </span>
              <span className="mono-num shrink-0 text-[11px] text-muted-foreground">
                {new Date(call.createdAt).toLocaleString([], {
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          ))
        )}
      </Section>

      <Section title="Chats" Icon={MessageSquare}>
        <EmptyRow>No chat integration connected yet</EmptyRow>
      </Section>

      <Section title="Important Emails" Icon={Mail}>
        {emails.length === 0 ? (
          <EmptyRow>No recent emails</EmptyRow>
        ) : (
          emails.map((email) => (
            <div key={email.id} className="flex flex-col gap-0.5 px-1 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium text-card-foreground">
                  {email.contact ? `${email.contact.firstName} ${email.contact.lastName}` : "Unknown"}
                </span>
                <span className="mono-num shrink-0 text-[11px] text-muted-foreground">
                  {new Date(email.createdAt).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
              {email.body && (
                <span className="truncate text-[11px] text-muted-foreground">{email.body}</span>
              )}
            </div>
          ))
        )}
      </Section>
    </div>
  );
}
