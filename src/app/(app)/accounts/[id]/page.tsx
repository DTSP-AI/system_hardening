"use client";

import { use } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActivityTimeline } from "@/components/activity-timeline";
import { TagPicker } from "@/components/tag-picker";
import { AttachmentsList } from "@/components/shared/attachments-list";
import { DetailPageGrid } from "@/components/shared/detail-page-grid";
import { EditEntityDialog, type EditFieldSchema } from "@/components/shared/edit-entity-dialog";
import { toast } from "sonner";

const ACCOUNT_EDIT_FIELDS: EditFieldSchema[] = [
  { name: "name", label: "Name", type: "text", required: true },
  { name: "contractValue", label: "Contract Value", type: "number" },
  { name: "startDate", label: "Start Date", type: "date" },
];

const ACCOUNT_STATUSES = ["ACTIVE", "CHURNED"] as const;

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 py-1.5 last:border-b-0">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm text-card-foreground">{value}</span>
    </div>
  );
}

export default function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const utils = trpc.useUtils();
  const account = trpc.account.byId.useQuery({ id });

  const updateAccount = trpc.account.update.useMutation({
    onSuccess: () => {
      utils.account.byId.invalidate({ id });
      toast.success("Account updated");
    },
    onError: (err) => toast.error(err.message),
  });

  if (account.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!account.data) return null;
  const a = account.data;

  return (
    <DetailPageGrid
      left={
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-card-foreground">{a.name}</h1>
            <div className="flex items-center gap-2">
              <Badge variant={a.status === "ACTIVE" ? "default" : "outline"}>{a.status}</Badge>
              <EditEntityDialog
                title="Edit Account"
                fields={ACCOUNT_EDIT_FIELDS}
                values={a}
                isSaving={updateAccount.isPending}
                onSave={(data) => updateAccount.mutate({ id, ...data })}
              />
            </div>
          </div>
          <Separator className="my-4" />
          <div className="flex flex-col">
            <div className="flex flex-col gap-1.5 pb-3">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Status</span>
              <Select
                value={a.status}
                onValueChange={(status) =>
                  updateAccount.mutate({ id, status: status as (typeof ACCOUNT_STATUSES)[number] })
                }
                disabled={updateAccount.isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0) + s.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field
              label="Contract value"
              value={a.contractValue ? `$${Number(a.contractValue).toLocaleString()}` : "—"}
            />
            <Field label="Start date" value={new Date(a.startDate).toLocaleDateString()} />
            <Field
              label="Contact"
              value={
                a.contact ? (
                  <Link href={`/contacts/${a.contact.id}`} className="hover:text-accent-foreground">
                    {a.contact.firstName} {a.contact.lastName}
                  </Link>
                ) : (
                  "—"
                )
              }
            />
            <Field
              label="Company"
              value={
                a.company ? (
                  <Link href={`/companies/${a.company.id}`} className="hover:text-accent-foreground">
                    {a.company.name}
                  </Link>
                ) : (
                  "—"
                )
              }
            />
            <Field
              label="Source deal"
              value={
                a.sourceDeal ? (
                  <Link href={`/deals/${a.sourceDeal.id}`} className="hover:text-accent-foreground">
                    {a.sourceDeal.name}
                  </Link>
                ) : (
                  "—"
                )
              }
            />
            <TagPicker entityType="ACCOUNT" entityId={id} />
          </div>
        </>
      }
      right={
        <div className="flex flex-col gap-6">
          <Card className="bg-card border-border p-6">
            <h2 className="mb-4 text-sm font-semibold text-card-foreground">Activity</h2>
            <ActivityTimeline
              activities={a.activities}
              accountId={id}
              onChanged={() => utils.account.byId.invalidate({ id })}
            />
          </Card>
          <Card className="bg-card border-border p-6">
            <AttachmentsList entityType="ACCOUNT" entityId={id} />
          </Card>
        </div>
      }
    />
  );
}
