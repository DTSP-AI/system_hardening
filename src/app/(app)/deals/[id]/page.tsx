"use client";

import { use } from "react";
import Link from "next/link";
import { PhoneCall } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActivityTimeline } from "@/components/activity-timeline";
import { TagPicker } from "@/components/tag-picker";
import { useCallStore } from "@/lib/stores/call-store";
import { toast } from "sonner";
import { EditEntityDialog, type EditFieldSchema } from "@/components/shared/edit-entity-dialog";
import { CustomFieldsDisplay } from "@/components/shared/custom-fields";
import { DetailPageGrid } from "@/components/shared/detail-page-grid";

const DEAL_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

const DEAL_EDIT_FIELDS: EditFieldSchema[] = [
  { name: "name", label: "Name", type: "text", required: true },
  { name: "amount", label: "Amount", type: "number" },
  { name: "currency", label: "Currency", type: "text" },
  { name: "expectedCloseDate", label: "Expected Close Date", type: "date" },
  {
    name: "priority",
    label: "Priority",
    type: "select",
    options: DEAL_PRIORITIES.map((p) => ({ value: p, label: p.charAt(0) + p.slice(1).toLowerCase() })),
  },
  { name: "source", label: "Source", type: "text" },
  { name: "description", label: "Description", type: "textarea" },
  { name: "nextStep", label: "Next Step", type: "textarea" },
];

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 py-1.5 last:border-b-0">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm text-card-foreground">{value}</span>
    </div>
  );
}

export default function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const utils = trpc.useUtils();
  const deal = trpc.deal.byId.useQuery({ id });
  const requestCall = useCallStore((s) => s.requestCall);

  const stages = trpc.pipelineStage.list.useQuery();
  const moveStage = trpc.deal.moveStage.useMutation({
    onSuccess: () => {
      utils.deal.byId.invalidate({ id });
      toast.success("Stage updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateDeal = trpc.deal.update.useMutation({
    onSuccess: () => {
      utils.deal.byId.invalidate({ id });
      toast.success("Deal updated");
    },
    onError: (err) => toast.error(err.message),
  });

  if (deal.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!deal.data) return null;

  return (
    <DetailPageGrid
      left={
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-card-foreground">{deal.data.name}</h1>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  deal.data.status === "WON"
                    ? "default"
                    : deal.data.status === "LOST"
                      ? "destructive"
                      : "secondary"
                }
              >
                {deal.data.status}
              </Badge>
              <EditEntityDialog
                title="Edit Deal"
                fields={DEAL_EDIT_FIELDS}
                values={deal.data}
                customFields={{ entityType: "DEAL", values: deal.data.customFields }}
                isSaving={updateDeal.isPending}
                onSave={(data) => updateDeal.mutate({ id, ...data })}
              />
            </div>
          </div>
          <Separator className="my-4" />
          <div className="flex flex-col">
            <div className="flex flex-col gap-1.5 pb-3">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Stage</span>
              <Select
                value={deal.data.stageId}
                onValueChange={(stageId) => moveStage.mutate({ id, stageId })}
                disabled={moveStage.isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(stages.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field
              label="Amount"
              value={deal.data.amount ? `$${Number(deal.data.amount).toLocaleString()}` : "—"}
            />
            {deal.data.priority && <Field label="Priority" value={deal.data.priority.charAt(0) + deal.data.priority.slice(1).toLowerCase()} />}
            {deal.data.source && <Field label="Source" value={deal.data.source} />}
            {deal.data.expectedCloseDate && (
              <Field label="Expected Close" value={new Date(deal.data.expectedCloseDate).toLocaleDateString()} />
            )}
            {deal.data.nextStep && <Field label="Next Step" value={deal.data.nextStep} />}
            {deal.data.description && <Field label="Description" value={deal.data.description} />}
            <div className="flex items-end justify-between gap-2">
              <Field
                label="Contact"
                value={
                  deal.data.contact ? (
                    <Link href={`/contacts/${deal.data.contact.id}`} className="hover:text-accent-foreground">
                      {deal.data.contact.firstName} {deal.data.contact.lastName}
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
              {deal.data.contact?.phone && (
                <div className="flex gap-2">
                  <Button
                    size="icon-sm"
                    variant="outline"
                    onClick={() =>
                      requestCall({
                        phone: deal.data!.contact!.phone!,
                        contactId: deal.data!.contact!.id,
                        dealId: deal.data!.id,
                        displayName: `${deal.data!.contact!.firstName} ${deal.data!.contact!.lastName}`,
                      })
                    }
                  >
                    <PhoneCall className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>
            <Field
              label="Company"
              value={
                deal.data.company ? (
                  <Link href={`/companies/${deal.data.company.id}`} className="hover:text-accent-foreground">
                    {deal.data.company.name}
                  </Link>
                ) : (
                  "—"
                )
              }
            />
            <CustomFieldsDisplay entityType="DEAL" values={deal.data.customFields} />
            <TagPicker entityType="DEAL" entityId={id} />
          </div>
        </>
      }
      right={
        <div className="flex flex-col gap-6">
          <Card className="bg-card border-border p-6">
            <h2 className="mb-4 text-sm font-semibold text-card-foreground">Activity</h2>
            <ActivityTimeline
              activities={deal.data.activities}
              dealId={id}
              onChanged={() => utils.deal.byId.invalidate({ id })}
            />
          </Card>
        </div>
      }
    />
  );
}
