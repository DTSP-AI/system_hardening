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

const VENDOR_TYPES = [
  "PANEL_MANUFACTURER",
  "INVERTER_MANUFACTURER",
  "BATTERY_MANUFACTURER",
  "RACKING_MANUFACTURER",
  "DISTRIBUTOR",
  "OTHER",
] as const;

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  SOLD: "outline",
  SITE_SURVEY: "outline",
  DESIGN: "outline",
  PERMITTING: "secondary",
  SCHEDULED: "secondary",
  INSTALLING: "secondary",
  INSTALLED: "default",
  INSPECTION: "secondary",
  UTILITY_PTO: "secondary",
  COMPLETE: "default",
  CANCELLED: "destructive",
};

const VENDOR_EDIT_FIELDS: EditFieldSchema[] = [
  { name: "name", label: "Name", type: "text", required: true },
  {
    name: "type",
    label: "Type",
    type: "select",
    options: VENDOR_TYPES.map((t) => ({ value: t, label: t.replaceAll("_", " ") })),
  },
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

export default function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const utils = trpc.useUtils();
  const vendor = trpc.vendor.byId.useQuery({ id });

  const updateVendor = trpc.vendor.update.useMutation({
    onSuccess: () => {
      utils.vendor.byId.invalidate({ id });
      toast.success("Vendor updated");
    },
    onError: (err) => toast.error(err.message),
  });

  if (vendor.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!vendor.data) return null;

  const projects = [...vendor.data.panelProjects, ...vendor.data.inverterProjects];

  return (
    <DetailPageGrid
      left={
        <>
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl font-bold text-card-foreground">{vendor.data.name}</h1>
            <EditEntityDialog
              title="Edit Vendor"
              fields={VENDOR_EDIT_FIELDS}
              values={vendor.data}
              isSaving={updateVendor.isPending}
              onSave={(data) => updateVendor.mutate({ id, ...data })}
            />
          </div>
          <Separator className="my-4" />
          <div className="flex flex-col">
            <Field label="Type" value={vendor.data.type.replaceAll("_", " ")} />
            <Field label="Phone" value={<span className="mono-num">{vendor.data.phone ?? "—"}</span>} />
            <Field label="Website" value={vendor.data.website ?? "—"} />
            <Field label="Portal URL" value={vendor.data.portalUrl ?? "—"} />
            {vendor.data.notes && <Field label="Notes" value={vendor.data.notes} />}
          </div>
        </>
      }
      right={
        <div className="flex flex-col gap-6">
          <Card className="bg-card border-border p-6">
            <h2 className="mb-4 text-sm font-semibold text-card-foreground">Projects</h2>
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects linked yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {projects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="flex items-center justify-between gap-2 text-sm text-card-foreground hover:text-accent-foreground"
                  >
                    <span>{project.projectNumber}</span>
                    <Badge variant={STATUS_VARIANT[project.status] ?? "outline"}>
                      {project.status.replaceAll("_", " ")}
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
