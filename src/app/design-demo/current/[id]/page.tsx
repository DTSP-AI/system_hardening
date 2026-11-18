"use client";

import { use } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, Mail } from "lucide-react";

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

export default function CurrentContactDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const contact = trpc.contact.byId.useQuery({ id });

  if (contact.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }
  if (!contact.data) return null;
  const c = contact.data;

  return (
    <div className="flex flex-col gap-8">
      <Link href="/design-demo/current" className="text-sm text-muted-foreground hover:text-foreground">
        ← All people
      </Link>

      <div className="flex items-center gap-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-xl font-semibold text-accent-foreground">
          {initials(c.firstName, c.lastName)}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold">
            {c.firstName} {c.lastName}
          </h1>
          <p className="text-muted-foreground">{c.company?.name ?? c.jobTitle ?? "No company"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled={!c.phone}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-30"
          >
            <Phone size={17} />
          </button>
          <button
            disabled={!c.email}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground transition hover:border-primary hover:text-primary disabled:opacity-30"
          >
            <Mail size={17} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-4 rounded-xl bg-secondary/60 p-5 sm:grid-cols-3">
        {[
          ["Email", c.email],
          ["Phone", c.phone],
          ["Lead source", c.leadSource],
          ["Type", c.type.charAt(0) + c.type.slice(1).toLowerCase()],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-sm font-medium">{value || "—"}</span>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Deals</h2>
        {c.deals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No deals yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {c.deals.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg bg-secondary/60 px-4 py-3 text-sm">
                <span className="font-medium">{d.name}</span>
                <span className="rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground">
                  {d.stage.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Timeline</h2>
        {c.activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {c.activities.map((a) => (
              <div key={a.id} className="flex items-start gap-3 text-sm">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div>
                  <p className="font-medium">
                    {a.type.charAt(0) + a.type.slice(1).toLowerCase()}
                    {a.body ? ` — ${a.body}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(a.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
