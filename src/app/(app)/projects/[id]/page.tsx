"use client";

import { use, useState } from "react";
import Link from "next/link";
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

const PROJECT_STATUSES = [
  "SOLD",
  "SITE_SURVEY",
  "DESIGN",
  "PERMITTING",
  "SCHEDULED",
  "INSTALLING",
  "INSTALLED",
  "INSPECTION",
  "UTILITY_PTO",
  "COMPLETE",
  "CANCELLED",
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

const PROJECT_COMMISSION_TYPES = ["SALE", "REFERRAL", "BONUS", "CHARGEBACK"] as const;

const SERVICE_TICKET_STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  OPEN: "default",
  SCHEDULED: "secondary",
  IN_PROGRESS: "secondary",
  RESOLVED: "secondary",
  CLOSED: "outline",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 py-1.5 last:border-b-0">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm text-card-foreground">{value}</span>
    </div>
  );
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const utils = trpc.useUtils();
  const project = trpc.project.byId.useQuery({ id });

  const setStatus = trpc.project.setStatus.useMutation({
    onSuccess: () => {
      utils.project.byId.invalidate({ id });
      toast.success("Status updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateProject = trpc.project.update.useMutation({
    onSuccess: () => {
      utils.project.byId.invalidate({ id });
      toast.success("Project updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const { definitions: projectCustomFieldDefs } = useCustomFieldDefinitions("PROJECT");

  const [commissionOpen, setCommissionOpen] = useState(false);
  const [commissionType, setCommissionType] = useState<string>("SALE");
  const [commissionAmount, setCommissionAmount] = useState("");
  const createCommission = trpc.projectCommission.create.useMutation({
    onSuccess: () => {
      utils.project.byId.invalidate({ id });
      toast.success("Commission added");
      setCommissionOpen(false);
      setCommissionType("SALE");
      setCommissionAmount("");
    },
    onError: (err) => toast.error(err.message),
  });

  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketNumber, setTicketNumber] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const createTicket = trpc.serviceTicket.create.useMutation({
    onSuccess: () => {
      utils.project.byId.invalidate({ id });
      toast.success("Service ticket added");
      setTicketOpen(false);
      setTicketNumber("");
      setTicketDescription("");
    },
    onError: (err) => toast.error(err.message),
  });

  if (project.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!project.data) return null;

  const customerHref = project.data.contactId
    ? `/contacts/${project.data.contactId}`
    : project.data.companyId
      ? `/companies/${project.data.companyId}`
      : null;
  const customerName = project.data.contact
    ? `${project.data.contact.firstName} ${project.data.contact.lastName}`
    : project.data.company?.name ?? "—";

  return (
    <DetailPageGrid
      left={
        <>
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-xl font-bold text-card-foreground">{project.data.projectNumber}</h1>
            <Badge variant={STATUS_VARIANT[project.data.status] ?? "outline"}>
              {project.data.status.replaceAll("_", " ")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{project.data.financingType.replaceAll("_", " ")}</p>
          <Separator className="my-4" />
          <div className="flex flex-col">
            <Field
              label="Customer"
              value={
                customerHref ? (
                  <Link href={customerHref} className="hover:text-accent-foreground">
                    {customerName}
                  </Link>
                ) : (
                  customerName
                )
              }
            />
            <Field label="System Size" value={`${Number(project.data.systemSizeKw)} kW`} />
            <Field label="Panel Count" value={project.data.panelCount} />
            <Field label="Contract Amount" value={`$${Number(project.data.contractAmount).toLocaleString()}`} />
            {project.data.panelVendor && <Field label="Panel Vendor" value={project.data.panelVendor.name} />}
            {project.data.inverterVendor && <Field label="Inverter Vendor" value={project.data.inverterVendor.name} />}
            {project.data.installCity && (
              <Field
                label="Install Address"
                value={[project.data.installAddressLine1, project.data.installCity, project.data.installState]
                  .filter(Boolean)
                  .join(", ")}
              />
            )}
            {project.data.soldDate && <Field label="Sold" value={new Date(project.data.soldDate).toLocaleDateString()} />}
            {project.data.ptoDate && <Field label="Utility PTO" value={new Date(project.data.ptoDate).toLocaleDateString()} />}
            <CustomFieldsDisplay entityType="PROJECT" values={project.data.customFields} />
            <div className="flex flex-col gap-1.5">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Status</span>
              <Select
                value={project.data.status}
                onValueChange={(v) => setStatus.mutate({ id, status: v as (typeof PROJECT_STATUSES)[number] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replaceAll("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <TagPicker entityType="PROJECT" entityId={id} />
            {projectCustomFieldDefs.length > 0 && (
              <EditEntityDialog
                title="Edit Custom Fields"
                fields={[]}
                values={project.data}
                customFields={{ entityType: "PROJECT", values: project.data.customFields }}
                isSaving={updateProject.isPending}
                trigger={<Button size="sm" variant="outline">Custom Fields</Button>}
                onSave={(data) => updateProject.mutate({ id, ...data })}
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
                          {PROJECT_COMMISSION_TYPES.map((t) => (
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
                          projectId: id,
                          type: commissionType as (typeof PROJECT_COMMISSION_TYPES)[number],
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
            {project.data.commissions.length === 0 ? (
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
                  {project.data.commissions.map((c) => (
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
              <h2 className="text-sm font-semibold text-card-foreground">Service Tickets</h2>
              <Dialog open={ticketOpen} onOpenChange={setTicketOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">Add Ticket</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Service Ticket</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="ticketNumber">Ticket Number</Label>
                      <Input id="ticketNumber" value={ticketNumber} onChange={(e) => setTicketNumber(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="ticketDescription">Description</Label>
                      <Input id="ticketDescription" value={ticketDescription} onChange={(e) => setTicketDescription(e.target.value)} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      disabled={!ticketNumber || createTicket.isPending}
                      onClick={() =>
                        createTicket.mutate({
                          projectId: id,
                          ticketNumber,
                          description: ticketDescription || undefined,
                        })
                      }
                    >
                      Add
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {project.data.serviceTickets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No service tickets filed.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket #</TableHead>
                    <TableHead>Issue</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {project.data.serviceTickets.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-card-foreground">{t.ticketNumber}</TableCell>
                      <TableCell className="text-muted-foreground">{t.issueType.replaceAll("_", " ")}</TableCell>
                      <TableCell>
                        <Badge variant={SERVICE_TICKET_STATUS_VARIANT[t.status] ?? "outline"}>{t.status.replaceAll("_", " ")}</Badge>
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
              activities={project.data.activities}
              projectId={id}
              onChanged={() => utils.project.byId.invalidate({ id })}
            />
          </Card>
        </div>
      }
    />
  );
}
