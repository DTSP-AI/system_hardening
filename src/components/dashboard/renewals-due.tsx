"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CalendarClock } from "lucide-react";

function daysUntil(date: Date | string) {
  const ms = new Date(date).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function RenewalsDue() {
  const expiring = trpc.policy.expiringSoon.useQuery({ withinDays: 90 });

  if (expiring.isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const policies = (expiring.data ?? []).slice(0, 5);

  if (policies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1.5 py-3 text-xs text-muted-foreground">
        <CalendarClock className="size-5" />
        No renewals due in the next 90 days
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {policies.map((policy) => {
        const who = policy.contact
          ? `${policy.contact.firstName} ${policy.contact.lastName}`
          : (policy.company?.name ?? policy.policyNumber);
        const days = daysUntil(policy.expirationDate);
        return (
          <Link
            key={policy.id}
            href={`/policies/${policy.id}`}
            className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-2 py-1.5 hover:bg-accent"
          >
            <div className="flex flex-col">
              <span className="text-xs font-medium text-card-foreground">{who}</span>
              <span className="text-[11px] text-muted-foreground">
                {policy.policyNumber} — {policy.carrier.name}
              </span>
            </div>
            <Badge variant={days <= 30 ? "destructive" : "secondary"} className="mono-num">
              {days}d
            </Badge>
          </Link>
        );
      })}
      <Link
        href="/renewals"
        className="mt-1 text-center text-[11px] text-muted-foreground hover:text-accent-foreground"
      >
        View all renewals
      </Link>
    </div>
  );
}
