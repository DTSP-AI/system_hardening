"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

type CompanyRow = RouterOutputs["company"]["list"][number];

const COMPANY_CSV_COLUMNS: CsvColumn<CompanyRow>[] = [
  { key: "name", label: "Name" },
  { key: "domain", label: "Domain" },
  { key: "industry", label: "Industry" },
  { key: "addressLine1", label: "Address Line 1" },
  { key: "addressLine2", label: "Address Line 2" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "postalCode", label: "Postal Code" },
  { key: "country", label: "Country" },
];

const COMPANY_IMPORT_FIELDS: ImportField[] = [
  { key: "name", label: "Name", required: true },
  { key: "domain", label: "Domain" },
  { key: "industry", label: "Industry" },
  { key: "addressLine1", label: "Address Line 1" },
  { key: "addressLine2", label: "Address Line 2" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "postalCode", label: "Postal Code" },
  { key: "country", label: "Country" },
];

export default function CompaniesPage() {
  const utils = trpc.useUtils();
  const { isAdmin } = useCurrentRole();
  const companies = trpc.company.list.useQuery();
  const createCompany = trpc.company.create.useMutation({
    onSuccess: () => {
      utils.company.list.invalidate();
      toast.success("Company created");
    },
    onError: (err) => toast.error(err.message),
  });
  const bulkCreateCompanies = trpc.company.bulkCreate.useMutation({
    onSuccess: (result) => {
      utils.company.list.invalidate();
      toast.success(`Imported ${result.count} compan${result.count === 1 ? "y" : "ies"}`);
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteManyCompanies = trpc.company.deleteMany.useMutation({
    onSuccess: (result) => {
      utils.company.list.invalidate();
      toast.success(`Deleted ${result.count} compan${result.count === 1 ? "y" : "ies"}`);
      clearSelection();
    },
    onError: (err) => toast.error(err.message),
  });

  async function handleImportCompanies(rows: Record<string, string>[]) {
    await bulkCreateCompanies.mutateAsync({
      rows: rows.map((row) => ({
        name: row.name,
        domain: row.domain || undefined,
        industry: row.industry || undefined,
        addressLine1: row.addressLine1 || undefined,
        addressLine2: row.addressLine2 || undefined,
        city: row.city || undefined,
        state: row.state || undefined,
        postalCode: row.postalCode || undefined,
        country: row.country || undefined,
      })),
    });
  }

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [industry, setIndustry] = useState("");

  function resetForm() {
    setName("");
    setDomain("");
    setIndustry("");
  }

  function handleCreate() {
    createCompany.mutate(
      { name, domain: domain || undefined, industry: industry || undefined },
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
  } = useRowSelection(companies.data);

  function handleBulkDelete() {
    if (!window.confirm(`Delete ${selectedIds.length} compan${selectedIds.length === 1 ? "y" : "ies"}? This cannot be undone.`)) return;
    deleteManyCompanies.mutate({ ids: selectedIds });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Companies</h1>
        <div className="flex items-center gap-2">
          <ExportCsvButton
            data={companies.data}
            columns={COMPANY_CSV_COLUMNS}
            filename="companies.csv"
          />
          {isAdmin && (
            <ImportCsvDialog
              title="Import Companies"
              fields={COMPANY_IMPORT_FIELDS}
              onImport={handleImportCompanies}
              isImporting={bulkCreateCompanies.isPending}
            />
          )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>New Company</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Company</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="domain">Domain</Label>
                <Input id="domain" value={domain} onChange={(e) => setDomain(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="industry">Industry</Label>
                <Input id="industry" value={industry} onChange={(e) => setIndustry(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={!name || createCompany.isPending}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <BulkActionsToolbar count={selectedIds.length} onClear={clearSelection}>
        <BulkTagSelect entityType="COMPANY" entityIds={selectedIds} onDone={clearSelection} />
        {isAdmin && (
          <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={deleteManyCompanies.isPending}>
            Delete selected
          </Button>
        )}
      </BulkActionsToolbar>

      <Card className="bg-card border-border p-0 overflow-hidden">
        {companies.isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : companies.data?.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            No companies yet — create your first one.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Industry</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.data?.map((company) => (
                <TableRow key={company.id}>
                  <TableCell>
                    <Checkbox
                      checked={isSelected(company.id)}
                      onCheckedChange={() => toggle(company.id)}
                      aria-label={`Select ${company.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Link href={`/companies/${company.id}`} className="font-medium hover:text-accent-foreground">
                      {company.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{company.domain ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{company.industry ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
