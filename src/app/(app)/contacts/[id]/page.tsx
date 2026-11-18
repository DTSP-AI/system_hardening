"use client";

import { use } from "react";
import Link from "next/link";
import { PhoneCall } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { isInsuranceOrgSlug } from "@/lib/tenant-vertical";
import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ActivityTimeline } from "@/components/activity-timeline";
import { TagPicker } from "@/components/tag-picker";
import { Badge } from "@/components/ui/badge";
import { useCallStore } from "@/lib/stores/call-store";
import { toast } from "sonner";
import { EditEntityDialog, type EditFieldSchema } from "@/components/shared/edit-entity-dialog";
import { CustomFieldsDisplay } from "@/components/shared/custom-fields";
import { DetailPageGrid } from "@/components/shared/detail-page-grid";

const CONTACT_TYPES = ["CUSTOMER", "VENDOR", "PARTNER"] as const;

const CONTACT_EDIT_FIELDS: EditFieldSchema[] = [
  { name: "firstName", label: "First Name", type: "text", required: true },
  { name: "lastName", label: "Last Name", type: "text", required: true },
  { name: "email", label: "Email", type: "text" },
  { name: "phone", label: "Phone", type: "text" },
  { name: "jobTitle", label: "Job Title", type: "text" },
  { name: "leadSource", label: "Lead Source", type: "text" },
  {
    name: "type",
    label: "Type",
    type: "select",
    options: CONTACT_TYPES.map((t) => ({ value: t, label: t.charAt(0) + t.slice(1).toLowerCase() })),
  },
  { name: "addressLine1", label: "Address Line 1", type: "text" },
  { name: "addressLine2", label: "Address Line 2", type: "text" },
  { name: "city", label: "City", type: "text" },
  { name: "state", label: "State", type: "text" },
  { name: "postalCode", label: "Postal Code", type: "text" },
  { name: "country", label: "Country", type: "text" },
];

const POLICY_STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  QUOTE: "outline",
  ACTIVE: "default",
  PENDING_RENEWAL: "secondary",
  RENEWED: "secondary",
  CANCELLED: "destructive",
  NON_RENEWED: "destructive",
  EXPIRED: "outline",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 py-1.5 last:border-b-0">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm text-card-foreground">{value}</span>
    </div>
  );
}

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { orgSlug } = useAuth();
  const isFoundry = isInsuranceOrgSlug(orgSlug);
  const utils = trpc.useUtils();
  const contact = trpc.contact.byId.useQuery({ id });
  const requestCall = useCallStore((s) => s.requestCall);

  const updateContact = trpc.contact.update.useMutation({
    onSuccess: () => {
      utils.contact.byId.invalidate({ id });
      toast.success("Contact updated");
    },
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
    <DetailPageGrid
      left={
        <>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold text-card-foreground">
                {contact.data.firstName} {contact.data.lastName}
              </h1>
              {contact.data.jobTitle && (
                <p className="text-sm text-muted-foreground">{contact.data.jobTitle}</p>
              )}
            </div>
            <EditEntityDialog
              title="Edit Contact"
              fields={CONTACT_EDIT_FIELDS}
              values={contact.data}
              customFields={{ entityType: "CONTACT", values: contact.data.customFields }}
              isSaving={updateContact.isPending}
              onSave={(data) => updateContact.mutate({ id, ...data })}
            />
          </div>
          <Separator className="my-4" />
          <div className="flex flex-col">
            <Field label="Email" value={contact.data.email ?? "—"} />
            <div className="flex items-end justify-between gap-2">
              <Field label="Phone" value={<span className="mono-num">{contact.data.phone ?? "—"}</span>} />
              {contact.data.phone && (
                <div className="flex gap-2">
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
                </div>
              )}
            </div>
            <Field
              label="Company"
              value={
                contact.data.company ? (
                  <Link href={`/companies/${contact.data.company.id}`} className="hover:text-accent-foreground">
                    {contact.data.company.name}
                  </Link>
                ) : (
                  "—"
                )
              }
            />
            <Field label="Lead source" value={contact.data.leadSource ?? "—"} />
            <Field label="Type" value={contact.data.type.charAt(0) + contact.data.type.slice(1).toLowerCase()} />
            <Field
              label="Address"
              value={
                [contact.data.addressLine1, contact.data.city, contact.data.state, contact.data.country]
                  .filter(Boolean)
                  .join(", ") || "—"
              }
            />
            <CustomFieldsDisplay entityType="CONTACT" values={contact.data.customFields} />
            <TagPicker entityType="CONTACT" entityId={id} />
          </div>
        </>
      }
      right={
        <div className="flex flex-col gap-6">
          {isFoundry && (
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
          )}

          <Card className="bg-card border-border p-6">
            <h2 className="mb-4 text-sm font-semibold text-card-foreground">Activity</h2>
            <ActivityTimeline
              activities={contact.data.activities}
              contactId={id}
              onChanged={() => utils.contact.byId.invalidate({ id })}
            />
          </Card>
        </div>
      }
    />
  );
}
