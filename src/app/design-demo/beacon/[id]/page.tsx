"use client";

import { use } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm">{value ?? "—"}</span>
    </div>
  );
}

export default function BeaconContactDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const contact = trpc.contact.byId.useQuery({ id });

  if (contact.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  if (!contact.data) return null;
  const c = contact.data;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/design-demo/beacon" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to contacts
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        <div className="flex flex-col gap-4 rounded-xl border border-border p-5">
          <div className="flex flex-col items-center gap-3 border-b border-border pb-5 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-lg font-semibold text-accent-foreground">
              {initials(c.firstName, c.lastName)}
            </div>
            <div>
              <p className="font-semibold">
                {c.firstName} {c.lastName}
              </p>
              <p className="text-sm text-muted-foreground">{c.jobTitle ?? c.company?.name ?? ""}</p>
            </div>
          </div>
          <div className="divide-y divide-border">
            <Field label="Email" value={c.email} />
            <Field label="Phone" value={c.phone} />
            <Field label="Company" value={c.company?.name} />
            <Field label="Lead source" value={c.leadSource} />
            <Field
              label="Type"
              value={c.type.charAt(0) + c.type.slice(1).toLowerCase()}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border p-5">
            <h2 className="mb-4 text-sm font-semibold text-muted-foreground">Deals</h2>
            {c.deals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deals yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {c.deals.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2 text-sm">
                    <span>{d.name}</span>
                    <span className="text-muted-foreground">{d.stage.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border p-5">
            <h2 className="mb-4 text-sm font-semibold text-muted-foreground">Activity</h2>
            {c.activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity logged yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {c.activities.map((a) => (
                  <div key={a.id} className="border-l-2 border-accent-foreground/30 pl-3 text-sm">
                    <p className="font-medium">{a.type.charAt(0) + a.type.slice(1).toLowerCase()}</p>
                    {a.body && <p className="text-muted-foreground">{a.body}</p>}
                    <p className="text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
