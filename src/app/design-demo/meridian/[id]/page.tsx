"use client";

import { use } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function HighlightField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm">{value ?? "—"}</span>
    </div>
  );
}

export default function MeridianContactDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const contact = trpc.contact.byId.useQuery({ id });

  if (contact.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!contact.data) return null;
  const c = contact.data;

  return (
    <div className="flex flex-col gap-3">
      <Link href="/design-demo/meridian" className="text-xs text-primary hover:underline">
        ← Back to Contacts
      </Link>

      <div className="rounded border border-border bg-card p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Contact</p>
        <h1 className="mt-0.5 text-xl font-semibold">
          {c.firstName} {c.lastName}
        </h1>
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
          <HighlightField label="Account name" value={c.company?.name} />
          <HighlightField label="Email" value={c.email} />
          <HighlightField label="Phone" value={c.phone} />
          <HighlightField
            label="Contact type"
            value={c.type.charAt(0) + c.type.slice(1).toLowerCase()}
          />
        </div>
      </div>

      <Tabs defaultValue="related">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="related">Related</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <div className="rounded border border-border bg-card p-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <HighlightField label="Lead source" value={c.leadSource} />
              <HighlightField label="Job title" value={c.jobTitle} />
              <HighlightField
                label="Created"
                value={new Date(c.createdAt).toLocaleDateString()}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="related">
          <div className="flex flex-col gap-3">
            <div className="rounded border border-border bg-card">
              <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Opportunities ({c.deals.length})
              </div>
              {c.deals.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No related opportunities.</p>
              ) : (
                <div className="divide-y divide-border">
                  {c.deals.map((d) => (
                    <div key={d.id} className="flex items-center justify-between px-4 py-2 text-sm">
                      <span>{d.name}</span>
                      <span className="text-muted-foreground">{d.stage.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded border border-border bg-card">
              <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Policies ({c.policies.length})
              </div>
              {c.policies.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No related policies.</p>
              ) : (
                <div className="divide-y divide-border">
                  {c.policies.map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-4 py-2 text-sm">
                      <span>{p.policyNumber}</span>
                      <span className="text-muted-foreground">{p.carrier.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <div className="rounded border border-border bg-card p-4">
            {c.activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity logged.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {c.activities.map((a) => (
                  <div key={a.id} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
                    <span>
                      {a.type.charAt(0) + a.type.slice(1).toLowerCase()}
                      {a.body ? ` — ${a.body}` : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
