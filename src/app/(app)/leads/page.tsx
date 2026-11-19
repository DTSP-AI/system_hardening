"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ExportCsvButton } from "@/components/shared/export-csv-button";
import { ImportCsvDialog, type ImportField } from "@/components/shared/import-csv-dialog";
import { useCurrentRole } from "@/lib/hooks/use-current-role";
import { useRowSelection } from "@/lib/hooks/use-row-selection";
import { BulkActionsToolbar } from "@/components/shared/bulk-actions-toolbar";
import { BulkTagSelect } from "@/components/shared/bulk-tag-select";
import { Checkbox } from "@/components/ui/checkbox";
import type { CsvColumn } from "@/lib/csv";
import type { RouterOutputs } from "@/lib/trpc/types";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  NEW: "default",
  CONTACTED: "secondary",
  QUALIFIED: "secondary",
  UNQUALIFIED: "outline",
  CONVERTED: "outline",
};

type LeadRow = RouterOutputs["lead"]["list"][number];

const LEAD_CSV_COLUMNS: CsvColumn<LeadRow>[] = [
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "companyName", label: "Company" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "jobTitle", label: "Job Title" },
  { key: "source", label: "Source" },
  { key: "status", label: "Status" },
];

const LEAD_IMPORT_FIELDS: ImportField[] = [
  { key: "firstName", label: "First Name", required: true },
  { key: "lastName", label: "Last Name", required: true },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "companyName", label: "Company" },
  { key: "jobTitle", label: "Job Title" },
  { key: "source", label: "Source" },
];

export default function LeadsPage() {
  const utils = trpc.useUtils();
  const { isAdmin } = useCurrentRole();
  const leads = trpc.lead.list.useQuery();
  const createLead = trpc.lead.create.useMutation({
    onSuccess: () => {
      utils.lead.list.invalidate();
      toast.success("Lead created");
    },
    onError: (err) => toast.error(err.message),
  });
  const bulkCreateLeads = trpc.lead.bulkCreate.useMutation({
    onSuccess: (result) => {
      utils.lead.list.invalidate();
      toast.success(`Imported ${result.count} lead${result.count === 1 ? "" : "s"}`);
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteManyLeads = trpc.lead.deleteMany.useMutation({
    onSuccess: (result) => {
      utils.lead.list.invalidate();
      toast.success(`Deleted ${result.count} lead${result.count === 1 ? "" : "s"}`);
      clearSelection();
    },
    onError: (err) => toast.error(err.message),
  });

  async function handleImportLeads(rows: Record<string, string>[]) {
    await bulkCreateLeads.mutateAsync({
      rows: rows.map((row) => ({
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email || undefined,
        phone: row.phone || undefined,
        companyName: row.companyName || undefined,
        jobTitle: row.jobTitle || undefined,
        source: row.source || undefined,
      })),
    });
  }

  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [source, setSource] = useState("");

  function resetForm() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setCompanyName("");
    setSource("");
  }

  function handleCreate() {
    createLead.mutate(
      {
        firstName,
        lastName,
        email: email || undefined,
        phone: phone || undefined,
        companyName: companyName || undefined,
        source: source || undefined,
      },
      { onSuccess: () => { setOpen(false); resetForm(); } },
    );
  }

  const {
    isSelected,
    selectedIds,
    toggle,
    toggleAll,
    clear: clearSelection,
    allSelected,
  } = useRowSelection(leads.data);

  function handleBulkDelete() {
    if (!window.confirm(`Delete ${selectedIds.length} lead${selectedIds.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
    deleteManyLeads.mutate({ ids: selectedIds });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5 text-sm">
            <span className="rounded bg-accent-foreground/15 px-2.5 py-1 font-medium text-accent-foreground">List</span>
            <Link
              href="/leads/board"
              className="rounded px-2.5 py-1 text-muted-foreground hover:text-foreground"
            >
              Board
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportCsvButton data={leads.data} columns={LEAD_CSV_COLUMNS} filename="leads.csv" />
          {isAdmin && (
            <ImportCsvDialog
              title="Import Leads"
              fields={LEAD_IMPORT_FIELDS}
              onImport={handleImportLeads}
              isImporting={bulkCreateLeads.isPending}
            />
          )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>New Lead</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Lead</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="firstName">First name</Label>
                  <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="companyName">Company</Label>
                <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="source">Source</Label>
                <Input id="source" placeholder="Referral, cold call, website…" value={source} onChange={(e) => setSource(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={!firstName || !lastName || createLead.isPending}
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <BulkActionsToolbar count={selectedIds.length} onClear={clearSelection}>
        <BulkTagSelect entityType="LEAD" entityIds={selectedIds} onDone={clearSelection} />
        {isAdmin && (
          <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={deleteManyLeads.isPending}>
            Delete selected
          </Button>
        )}
      </BulkActionsToolbar>

      <Card className="bg-card border-border p-0 overflow-hidden">
        {leads.isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : leads.data?.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            No leads yet — create your first one.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.data?.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <Checkbox
                      checked={isSelected(lead.id)}
                      onCheckedChange={() => toggle(lead.id)}
                      aria-label={`Select ${lead.firstName} ${lead.lastName}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Link href={`/leads/${lead.id}`} className="font-medium hover:text-accent-foreground">
                      {lead.firstName} {lead.lastName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{lead.companyName ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{lead.source ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[lead.status] ?? "outline"}>{lead.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
