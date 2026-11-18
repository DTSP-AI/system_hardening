"use client";

import { use } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { TagPicker } from "@/components/tag-picker";
import { toast } from "sonner";
import { EditEntityDialog, type EditFieldSchema } from "@/components/shared/edit-entity-dialog";
import { CustomFieldsDisplay } from "@/components/shared/custom-fields";
import { AttachmentsList } from "@/components/shared/attachments-list";
import { DetailPageGrid } from "@/components/shared/detail-page-grid";

const COMPANY_EDIT_FIELDS: EditFieldSchema[] = [
  { name: "name", label: "Name", type: "text", required: true },
  { name: "domain", label: "Domain", type: "text" },
  { name: "industry", label: "Industry", type: "text" },
  { name: "addressLine1", label: "Address Line 1", type: "text" },
  { name: "addressLine2", label: "Address Line 2", type: "text" },
  { name: "city", label: "City", type: "text" },
  { name: "state", label: "State", type: "text" },
  { name: "postalCode", label: "Postal Code", type: "text" },
  { name: "country", label: "Country", type: "text" },
];

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 py-1.5 last:border-b-0">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm text-card-foreground">{value}</span>
    </div>
  );
}

export default function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const utils = trpc.useUtils();
  const company = trpc.company.byId.useQuery({ id });

  const updateCompany = trpc.company.update.useMutation({
    onSuccess: () => {
      utils.company.byId.invalidate({ id });
      toast.success("Company updated");
    },
    onError: (err) => toast.error(err.message),
  });

  if (company.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!company.data) return null;

  return (
    <DetailPageGrid
      left={
        <>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold text-card-foreground">{company.data.name}</h1>
              {company.data.industry && (
                <p className="text-sm text-muted-foreground">{company.data.industry}</p>
              )}
            </div>
            <EditEntityDialog
              title="Edit Company"
              fields={COMPANY_EDIT_FIELDS}
              values={company.data}
              customFields={{ entityType: "COMPANY", values: company.data.customFields }}
              isSaving={updateCompany.isPending}
              onSave={(data) => updateCompany.mutate({ id, ...data })}
            />
          </div>
          <Separator className="my-4" />
          <div className="flex flex-col">
            <Field label="Domain" value={company.data.domain ?? "—"} />
            <Field
              label="Address"
              value={
                [company.data.addressLine1, company.data.city, company.data.state, company.data.country]
                  .filter(Boolean)
                  .join(", ") || "—"
              }
            />
            <CustomFieldsDisplay entityType="COMPANY" values={company.data.customFields} />
            <TagPicker entityType="COMPANY" entityId={id} />
          </div>
        </>
      }
      right={
        <div className="flex flex-col gap-6">
          <Card className="bg-card border-border p-6">
            <h2 className="mb-4 text-sm font-semibold text-card-foreground">Contacts</h2>
            {company.data.contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No contacts linked yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {company.data.contacts.map((contact) => (
                  <Link
                    key={contact.id}
                    href={`/contacts/${contact.id}`}
                    className="text-sm text-card-foreground hover:text-accent-foreground"
                  >
                    {contact.firstName} {contact.lastName}
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card className="bg-card border-border p-6">
            <h2 className="mb-4 text-sm font-semibold text-card-foreground">Deals</h2>
            {company.data.deals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deals linked yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {company.data.deals.map((deal) => (
                  <Link
                    key={deal.id}
                    href={`/deals/${deal.id}`}
                    className="text-sm text-card-foreground hover:text-accent-foreground"
                  >
                    {deal.name} — {deal.stage.name}
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card className="bg-card border-border p-6">
            <AttachmentsList entityType="COMPANY" entityId={id} />
          </Card>
        </div>
      }
    />
  );
}
