"use client";

import { use } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { EditEntityDialog, type EditFieldSchema } from "@/components/shared/edit-entity-dialog";
import { DetailPageGrid } from "@/components/shared/detail-page-grid";

const POLICY_STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  QUOTE: "outline",
  ACTIVE: "default",
  PENDING_RENEWAL: "secondary",
  RENEWED: "secondary",
  CANCELLED: "destructive",
  NON_RENEWED: "destructive",
  EXPIRED: "outline",
};

const CARRIER_EDIT_FIELDS: EditFieldSchema[] = [
  { name: "name", label: "Name", type: "text", required: true },
  { name: "naicCode", label: "NAIC Code", type: "text" },
  { name: "phone", label: "Phone", type: "text" },
  { name: "website", label: "Website", type: "text" },
  { name: "portalUrl", label: "Portal URL", type: "text" },
  { name: "notes", label: "Notes", type: "textarea" },
];

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 py-1.5 last:border-b-0">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm text-card-foreground">{value}</span>
    </div>
  );
}

export default function CarrierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const utils = trpc.useUtils();
  const carrier = trpc.carrier.byId.useQuery({ id });

  const updateCarrier = trpc.carrier.update.useMutation({
    onSuccess: () => {
      utils.carrier.byId.invalidate({ id });
      toast.success("Carrier updated");
    },
    onError: (err) => toast.error(err.message),
  });

  if (carrier.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!carrier.data) return null;

  return (
    <DetailPageGrid
      left={
        <>
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl font-bold text-card-foreground">{carrier.data.name}</h1>
            <EditEntityDialog
              title="Edit Carrier"
              fields={CARRIER_EDIT_FIELDS}
              values={carrier.data}
              isSaving={updateCarrier.isPending}
              onSave={(data) => updateCarrier.mutate({ id, ...data })}
            />
          </div>
          <Separator className="my-4" />
          <div className="flex flex-col">
            <Field label="NAIC Code" value={carrier.data.naicCode ?? "—"} />
            <Field label="Phone" value={<span className="mono-num">{carrier.data.phone ?? "—"}</span>} />
            <Field label="Website" value={carrier.data.website ?? "—"} />
            <Field label="Portal URL" value={carrier.data.portalUrl ?? "—"} />
            {carrier.data.notes && <Field label="Notes" value={carrier.data.notes} />}
          </div>
        </>
      }
      right={
        <div className="flex flex-col gap-6">
          <Card className="bg-card border-border p-6">
            <h2 className="mb-4 text-sm font-semibold text-card-foreground">Policies</h2>
            {carrier.data.policies.length === 0 ? (
              <p className="text-sm text-muted-foreground">No policies linked yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {carrier.data.policies.map((policy) => (
                  <Link
                    key={policy.id}
                    href={`/policies/${policy.id}`}
                    className="flex items-center justify-between gap-2 text-sm text-card-foreground hover:text-accent-foreground"
                  >
                    <span>
                      {policy.policyNumber} — {policy.lineOfBusiness.replaceAll("_", " ")}
                    </span>
                    <Badge variant={POLICY_STATUS_VARIANT[policy.status] ?? "outline"}>
                      {policy.status.replaceAll("_", " ")}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      }
    />
  );
}
