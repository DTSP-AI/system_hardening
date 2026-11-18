"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TagPicker } from "@/components/tag-picker";
import { AttachmentsList } from "@/components/shared/attachments-list";
import { DetailPageGrid } from "@/components/shared/detail-page-grid";
import { toast } from "sonner";

const STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "UNQUALIFIED", "CONVERTED"] as const;

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 py-1.5 last:border-b-0">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm text-card-foreground">{value}</span>
    </div>
  );
}

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const utils = trpc.useUtils();
  const lead = trpc.lead.byId.useQuery({ id });

  const setStatus = trpc.lead.setStatus.useMutation({
    onSuccess: () => utils.lead.byId.invalidate({ id }),
    onError: (err) => toast.error(err.message),
  });

  const convert = trpc.lead.convert.useMutation({
    onSuccess: (contact) => {
      toast.success("Lead converted to contact");
      utils.lead.byId.invalidate({ id });
      router.push(`/contacts/${contact.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  if (lead.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!lead.data) return null;

  const isConverted = lead.data.status === "CONVERTED";

  return (
    <DetailPageGrid
      left={
        <>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold text-card-foreground">
                {lead.data.firstName} {lead.data.lastName}
              </h1>
              {lead.data.jobTitle && (
                <p className="text-sm text-muted-foreground">{lead.data.jobTitle}</p>
              )}
            </div>
            <Badge variant={isConverted ? "outline" : "default"}>{lead.data.status}</Badge>
          </div>
          <Separator className="my-4" />
          <div className="flex flex-col">
            <Field label="Email" value={lead.data.email ?? "—"} />
            <Field label="Phone" value={<span className="mono-num">{lead.data.phone ?? "—"}</span>} />
            <Field label="Company" value={lead.data.companyName ?? "—"} />
            <Field label="Source" value={lead.data.source ?? "—"} />
            <TagPicker entityType="LEAD" entityId={id} />
          </div>

          <Separator className="my-4" />

          <div className="flex flex-col">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Status</span>
              <Select
                value={lead.data.status}
                onValueChange={(value) => setStatus.mutate({ id, status: value as (typeof STATUSES)[number] })}
                disabled={isConverted}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isConverted && lead.data.convertedContactId ? (
              <Button asChild variant="outline">
                <Link href={`/contacts/${lead.data.convertedContactId}`}>View converted contact</Link>
              </Button>
            ) : (
              <Button onClick={() => convert.mutate({ id })} disabled={convert.isPending}>
                Convert to Contact
              </Button>
            )}
          </div>
        </>
      }
      right={
        <div className="flex flex-col gap-6">
          <Card className="bg-card border-border p-6">
            <h2 className="mb-2 text-sm font-semibold text-card-foreground">About</h2>
            <p className="text-sm text-muted-foreground">
              Leads are unqualified prospects. Once you&apos;ve vetted this one, convert it to a
              Contact (and Company, if a company name was given) to start tracking deals and
              activity against it.
            </p>
          </Card>

          <Card className="bg-card border-border p-6">
            <AttachmentsList entityType="LEAD" entityId={id} />
          </Card>
        </div>
      }
    />
  );
}
