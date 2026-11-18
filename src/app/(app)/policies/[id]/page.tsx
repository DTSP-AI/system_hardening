"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { isInsuranceOrgSlug } from "@/lib/tenant-vertical";
import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TagPicker } from "@/components/tag-picker";
import { ActivityTimeline } from "@/components/activity-timeline";
import { EditEntityDialog } from "@/components/shared/edit-entity-dialog";
import { CustomFieldsDisplay, useCustomFieldDefinitions } from "@/components/shared/custom-fields";
import { DetailPageGrid } from "@/components/shared/detail-page-grid";
import { toast } from "sonner";

const POLICY_STATUSES = [
  "QUOTE",
  "ACTIVE",
  "PENDING_RENEWAL",
  "RENEWED",
  "CANCELLED",
  "NON_RENEWED",
  "EXPIRED",
] as const;

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  QUOTE: "outline",
  ACTIVE: "default",
  PENDING_RENEWAL: "secondary",
  RENEWED: "secondary",
  CANCELLED: "destructive",
  NON_RENEWED: "destructive",
  EXPIRED: "outline",
};

const COMMISSION_TYPES = ["NEW_BUSINESS", "RENEWAL", "CHARGEBACK", "BONUS"] as const;

const CLAIM_STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  OPEN: "default",
  CLOSED: "secondary",
  DENIED: "destructive",
  REOPENED: "outline",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 py-1.5 last:border-b-0">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm text-card-foreground">{value}</span>
    </div>
  );
}

export default function PolicyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { orgSlug } = useAuth();
  const isFoundry = isInsuranceOrgSlug(orgSlug);
  const utils = trpc.useUtils();
  const policy = trpc.policy.byId.useQuery({ id }, { enabled: isFoundry });

  const setStatus = trpc.policy.setStatus.useMutation({
    onSuccess: () => {
      utils.policy.byId.invalidate({ id });
      toast.success("Status updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const renew = trpc.policy.renew.useMutation({
    onSuccess: (renewed) => {
      utils.policy.byId.invalidate({ id });
      toast.success(`Renewed as new policy ${renewed.policyNumber}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const updatePolicy = trpc.policy.update.useMutation({
    onSuccess: () => {
      utils.policy.byId.invalidate({ id });
      toast.success("Policy updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const { definitions: policyCustomFieldDefs } = useCustomFieldDefinitions("POLICY");

  const [commissionOpen, setCommissionOpen] = useState(false);
  const [commissionType, setCommissionType] = useState<string>("NEW_BUSINESS");
  const [commissionAmount, setCommissionAmount] = useState("");
  const createCommission = trpc.commission.create.useMutation({
    onSuccess: () => {
      utils.policy.byId.invalidate({ id });
      toast.success("Commission added");
      setCommissionOpen(false);
      setCommissionType("NEW_BUSINESS");
      setCommissionAmount("");
    },
    onError: (err) => toast.error(err.message),
  });

  const [claimOpen, setClaimOpen] = useState(false);
  const [claimNumber, setClaimNumber] = useState("");
  const [dateOfLoss, setDateOfLoss] = useState("");
  const createClaim = trpc.claim.create.useMutation({
    onSuccess: () => {
      utils.policy.byId.invalidate({ id });
      toast.success("Claim added");
      setClaimOpen(false);
      setClaimNumber("");
      setDateOfLoss("");
    },
    onError: (err) => toast.error(err.message),
  });

  if (!isFoundry) {
    return (
      <p className="text-sm text-muted-foreground">
        Policies are only available to the Foundry Protects workspace.
      </p>
    );
  }

  if (policy.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!policy.data) return null;

  const insuredHref = policy.data.contactId
    ? `/contacts/${policy.data.contactId}`
    : policy.data.companyId
      ? `/companies/${policy.data.companyId}`
      : null;
  const insuredName = policy.data.contact
    ? `${policy.data.contact.firstName} ${policy.data.contact.lastName}`
    : policy.data.company?.name ?? "—";

  return (
    <DetailPageGrid
      left={
        <>
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-xl font-bold text-card-foreground">{policy.data.policyNumber}</h1>
            <Badge variant={STATUS_VARIANT[policy.data.status] ?? "outline"}>
              {policy.data.status.replaceAll("_", " ")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{policy.data.lineOfBusiness.replaceAll("_", " ")}</p>
          <Separator className="my-4" />
          <div className="flex flex-col">
            <Field label="Carrier" value={policy.data.carrier.name} />
            <Field
              label="Insured"
              value={
                insuredHref ? (
                  <Link href={insuredHref} className="hover:text-accent-foreground">
                    {insuredName}
                  </Link>
                ) : (
                  insuredName
                )
              }
            />
            <Field label="Premium" value={`$${Number(policy.data.premium).toLocaleString()}`} />
            <Field label="Billing" value={policy.data.billingType.replaceAll("_", " ")} />
            <Field label="Effective" value={new Date(policy.data.effectiveDate).toLocaleDateString()} />
            <Field label="Expires" value={new Date(policy.data.expirationDate).toLocaleDateString()} />
            {policy.data.renewedFrom && (
              <Field
                label="Renewed From"
                value={
                  <Link href={`/policies/${policy.data.renewedFrom.id}`} className="hover:text-accent-foreground">
                    {policy.data.renewedFrom.policyNumber}
                  </Link>
                }
              />
            )}
            <CustomFieldsDisplay entityType="POLICY" values={policy.data.customFields} />
            <div className="flex flex-col gap-1.5">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Status</span>
              <Select
                value={policy.data.status}
                onValueChange={(v) => setStatus.mutate({ id, status: v as (typeof POLICY_STATUSES)[number] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POLICY_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replaceAll("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {policy.data.status === "ACTIVE" && (
              <Button
                size="sm"
                variant="secondary"
                disabled={renew.isPending}
                onClick={() => renew.mutate({ id })}
              >
                Renew Policy
              </Button>
            )}
            <TagPicker entityType="POLICY" entityId={id} />
            {policyCustomFieldDefs.length > 0 && (
              <EditEntityDialog
                title="Edit Custom Fields"
                fields={[]}
                values={policy.data}
                customFields={{ entityType: "POLICY", values: policy.data.customFields }}
                isSaving={updatePolicy.isPending}
                trigger={<Button size="sm" variant="outline">Custom Fields</Button>}
                onSave={(data) => updatePolicy.mutate({ id, ...data })}
              />
            )}
          </div>
        </>
      }
      right={
        <div className="flex flex-col gap-6">
          <Card className="bg-card border-border p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-card-foreground">Commissions</h2>
              <Dialog open={commissionOpen} onOpenChange={setCommissionOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">Add Commission</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Commission</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label>Type</Label>
                      <Select value={commissionType} onValueChange={setCommissionType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COMMISSION_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t.replaceAll("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="commissionAmount">Amount</Label>
                      <Input
                        id="commissionAmount"
                        type="number"
                        value={commissionAmount}
                        onChange={(e) => setCommissionAmount(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      disabled={!commissionAmount || createCommission.isPending}
                      onClick={() =>
                        createCommission.mutate({
                          policyId: id,
                          type: commissionType as (typeof COMMISSION_TYPES)[number],
                          amount: Number(commissionAmount),
                        })
                      }
                    >
                      Add
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {policy.data.commissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No commissions logged yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policy.data.commissions.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-card-foreground">{c.type.replaceAll("_", " ")}</TableCell>
                      <TableCell className="text-muted-foreground">${Number(c.amount).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={c.paid ? "secondary" : "outline"}>{c.paid ? "Paid" : "Pending"}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>

          <Card className="bg-card border-border p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-card-foreground">Claims</h2>
              <Dialog open={claimOpen} onOpenChange={setClaimOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">Add Claim</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Claim</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="claimNumber">Claim Number</Label>
                      <Input id="claimNumber" value={claimNumber} onChange={(e) => setClaimNumber(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="dateOfLoss">Date of Loss</Label>
                      <Input id="dateOfLoss" type="date" value={dateOfLoss} onChange={(e) => setDateOfLoss(e.target.value)} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      disabled={!claimNumber || !dateOfLoss || createClaim.isPending}
                      onClick={() =>
                        createClaim.mutate({
                          policyId: id,
                          claimNumber,
                          dateOfLoss: new Date(dateOfLoss),
                        })
                      }
                    >
                      Add
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {policy.data.claims.length === 0 ? (
              <p className="text-sm text-muted-foreground">No claims filed.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Claim #</TableHead>
                    <TableHead>Date of Loss</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policy.data.claims.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-card-foreground">{c.claimNumber}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(c.dateOfLoss).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant={CLAIM_STATUS_VARIANT[c.status] ?? "outline"}>{c.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>

          <Card className="bg-card border-border p-6">
            <h2 className="mb-4 text-sm font-semibold text-card-foreground">Activity</h2>
            <ActivityTimeline
              activities={policy.data.activities}
              policyId={id}
              onChanged={() => utils.policy.byId.invalidate({ id })}
            />
          </Card>
        </div>
      }
    />
  );
}
