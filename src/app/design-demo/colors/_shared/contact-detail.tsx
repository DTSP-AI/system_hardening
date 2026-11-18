"use client";

import Link from "next/link";
import { PhoneCall } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ActivityTimeline } from "@/components/activity-timeline";
import { TagPicker } from "@/components/tag-picker";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PhoneCall as PhoneCallIcon, Mail, MessageSquare } from "lucide-react";
import { useCallStore } from "@/lib/stores/call-store";
import { toast } from "sonner";

const CONTACT_TYPES = ["CUSTOMER", "VENDOR", "PARTNER"] as const;

const POLICY_STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  QUOTE: "outline",
  ACTIVE: "default",
  PENDING_RENEWAL: "secondary",
  RENEWED: "secondary",
  CANCELLED: "destructive",
  NON_RENEWED: "destructive",
  EXPIRED: "outline",
};

// Demo-only sample data: the real Contact model has no address/DOB fields yet,
// these are deterministic per-contact placeholders for the mockup, not real data.
const SAMPLE_ADDRESSES = [
  "482 Harbor View Dr, Tampa, FL 33602",
  "129 Maple Ridge Ln, Charlotte, NC 28202",
  "77 Lakeshore Ct, Austin, TX 78701",
  "560 Cedar Grove Ave, Columbus, OH 43215",
];

function hashSeed(id: string) {
  return [...id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

function sampleAddress(id: string) {
  return SAMPLE_ADDRESSES[hashSeed(id) % SAMPLE_ADDRESSES.length];
}

function sampleDateOfBirth(id: string) {
  const seed = hashSeed(id);
  const year = 1955 + (seed % 45);
  const month = 1 + (seed % 12);
  const day = 1 + ((seed * 7) % 28);
  return `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}/${year}`;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm text-card-foreground">{value}</span>
    </div>
  );
}

type ActivityRow = {
  id: string;
  type: string;
  body: string | null;
  createdAt: Date | string;
};

function CommunicationLog({ entries, emptyLabel }: { entries: ActivityRow[]; emptyLabel: string }) {
  if (entries.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-col gap-3 py-2">
      {entries.map((entry) => (
        <div key={entry.id} className="rounded-md border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {new Date(entry.createdAt).toLocaleString()}
            </span>
          </div>
          {entry.body && <p className="mt-1 text-sm text-card-foreground">{entry.body}</p>}
        </div>
      ))}
    </div>
  );
}

function CommunicationsCard({ activities }: { activities: ActivityRow[] }) {
  const calls = activities.filter((a) => a.type === "CALL");
  const emails = activities.filter((a) => a.type === "EMAIL");

  return (
    <Card className="bg-card border-border p-6">
      <h2 className="mb-4 text-sm font-semibold text-card-foreground">Communications</h2>
      <Tabs defaultValue="calls">
        <TabsList>
          <TabsTrigger value="calls">
            <PhoneCallIcon className="mr-1.5 size-3.5" />
            Calls
          </TabsTrigger>
          <TabsTrigger value="emails">
            <Mail className="mr-1.5 size-3.5" />
            Emails
          </TabsTrigger>
          <TabsTrigger value="texts">
            <MessageSquare className="mr-1.5 size-3.5" />
            Texts
          </TabsTrigger>
        </TabsList>
        <TabsContent value="calls">
          <CommunicationLog entries={calls} emptyLabel="No calls logged yet." />
        </TabsContent>
        <TabsContent value="emails">
          <CommunicationLog entries={emails} emptyLabel="No emails logged yet." />
        </TabsContent>
        <TabsContent value="texts">
          <CommunicationLog entries={[]} emptyLabel="Texting isn't connected yet." />
        </TabsContent>
      </Tabs>
    </Card>
  );
}

export function ContactDetail({ id }: { id: string }) {
  const utils = trpc.useUtils();
  const contact = trpc.contact.byId.useQuery({ id });
  const requestCall = useCallStore((s) => s.requestCall);

  const updateType = trpc.contact.update.useMutation({
    onSuccess: () => utils.contact.byId.invalidate({ id }),
    onError: (err) => toast.error(err.message),
  });

  if (contact.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!contact.data) return null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr]">
      <Card className="bg-card border-border p-6">
        <h1 className="text-xl font-bold text-card-foreground">
          {contact.data.firstName} {contact.data.lastName}
        </h1>
        {contact.data.company && (
          <Link
            href={`/companies/${contact.data.company.id}`}
            className="text-sm font-medium text-card-foreground hover:text-accent-foreground"
          >
            {contact.data.company.name}
          </Link>
        )}
        {contact.data.jobTitle && (
          <p className="text-sm text-muted-foreground">{contact.data.jobTitle}</p>
        )}
        <Separator className="my-4" />
        <div className="flex flex-col gap-3">
          <Field label="Email" value={contact.data.email ?? "—"} />
          <div className="flex items-end justify-between gap-2">
            <Field label="Phone" value={contact.data.phone ?? "—"} />
            {contact.data.phone && (
              <Button
                size="icon-sm"
                variant="outline"
                onClick={() =>
                  requestCall({
                    phone: contact.data!.phone!,
                    contactId: contact.data!.id,
                    displayName: `${contact.data!.firstName} ${contact.data!.lastName}`,
                  })
                }
              >
                <PhoneCall className="size-3.5" />
              </Button>
            )}
          </div>
          <Field label="Address" value={sampleAddress(contact.data.id)} />
          <Field label="Date of birth" value={sampleDateOfBirth(contact.data.id)} />
          <Field
            label="Line of business"
            value={contact.data.company ? "Commercial Lines" : "Personal Lines"}
          />
          <Field label="Lead source" value={contact.data.leadSource ?? "—"} />
          <div className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Type</span>
            <Select
              value={contact.data.type}
              onValueChange={(value) => updateType.mutate({ id, type: value as (typeof CONTACT_TYPES)[number] })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <TagPicker entityType="CONTACT" entityId={id} />
        </div>
      </Card>

      <div className="flex flex-col gap-6">
        <Card className="bg-card border-border p-6">
          <h2 className="mb-4 text-sm font-semibold text-card-foreground">Policies</h2>
          {contact.data.policies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No policies linked yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {contact.data.policies.map((policy) => (
                <Link
                  key={policy.id}
                  href={`/policies/${policy.id}`}
                  className="flex items-center justify-between gap-2 text-sm text-card-foreground hover:text-accent-foreground"
                >
                  <span>
                    {policy.policyNumber} — {policy.lineOfBusiness.replaceAll("_", " ")} ({policy.carrier.name})
                  </span>
                  <Badge variant={POLICY_STATUS_VARIANT[policy.status] ?? "outline"}>
                    {policy.status.replaceAll("_", " ")}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <CommunicationsCard activities={contact.data.activities} />

        <Card className="bg-card border-border p-6">
          <h2 className="mb-4 text-sm font-semibold text-card-foreground">Activity</h2>
          <ActivityTimeline
            activities={contact.data.activities}
            contactId={id}
            onChanged={() => utils.contact.byId.invalidate({ id })}
          />
        </Card>
      </div>
    </div>
  );
}
