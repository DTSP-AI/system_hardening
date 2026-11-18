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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ExportCsvButton } from "@/components/shared/export-csv-button";
import { useCurrentRole } from "@/lib/hooks/use-current-role";
import { useRowSelection } from "@/lib/hooks/use-row-selection";
import { BulkActionsToolbar } from "@/components/shared/bulk-actions-toolbar";
import { BulkTagSelect } from "@/components/shared/bulk-tag-select";
import { Checkbox } from "@/components/ui/checkbox";
import type { CsvColumn } from "@/lib/csv";
import type { RouterOutputs } from "@/lib/trpc/types";

type ProjectRow = RouterOutputs["project"]["list"][number];

const PROJECT_CSV_COLUMNS: CsvColumn<ProjectRow>[] = [
  { key: "projectNumber", label: "Project #" },
  {
    key: "customer",
    label: "Customer",
    accessor: (p) =>
      p.contact ? `${p.contact.firstName} ${p.contact.lastName}` : p.company?.name,
  },
  { key: "systemSizeKw", label: "System Size (kW)" },
  { key: "panelCount", label: "Panel Count" },
  { key: "financingType", label: "Financing" },
  { key: "contractAmount", label: "Contract Amount" },
  { key: "status", label: "Status" },
];

const STATUS_TABS = [
  "ALL",
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

export default function ProjectsPage() {
  const utils = trpc.useUtils();
  const { isAdmin } = useCurrentRole();
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_TABS)[number]>("ALL");
  const projects = trpc.project.list.useQuery(
    statusFilter === "ALL" ? {} : { status: statusFilter },
  );
  const contacts = trpc.contact.list.useQuery();
  const companies = trpc.company.list.useQuery();

  const createProject = trpc.project.create.useMutation({
    onSuccess: () => {
      utils.project.list.invalidate();
      toast.success("Project created");
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteManyProjects = trpc.project.deleteMany.useMutation({
    onSuccess: (result) => {
      utils.project.list.invalidate();
      toast.success(`Deleted ${result.count} project${result.count === 1 ? "" : "s"}`);
      clearSelection();
    },
    onError: (err) => toast.error(err.message),
  });

  const [open, setOpen] = useState(false);
  const [projectNumber, setProjectNumber] = useState("");
  const [systemSizeKw, setSystemSizeKw] = useState("");
  const [panelCount, setPanelCount] = useState("");
  const [contractAmount, setContractAmount] = useState("");
  const [customerType, setCustomerType] = useState<"contact" | "company">("contact");
  const [customerId, setCustomerId] = useState("");

  function resetForm() {
    setProjectNumber("");
    setSystemSizeKw("");
    setPanelCount("");
    setContractAmount("");
    setCustomerType("contact");
    setCustomerId("");
  }

  function handleCreate() {
    if (!projectNumber || !systemSizeKw || !panelCount || !contractAmount) return;
    createProject.mutate(
      {
        projectNumber,
        systemSizeKw: Number(systemSizeKw),
        panelCount: Number(panelCount),
        contractAmount: Number(contractAmount),
        contactId: customerType === "contact" ? customerId || undefined : undefined,
        companyId: customerType === "company" ? customerId || undefined : undefined,
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
  } = useRowSelection(projects.data);

  function handleBulkDelete() {
    if (!window.confirm(`Delete ${selectedIds.length} project${selectedIds.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
    deleteManyProjects.mutate({ ids: selectedIds });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Projects</h1>
        <div className="flex items-center gap-2">
          <ExportCsvButton
            data={projects.data}
            columns={PROJECT_CSV_COLUMNS}
            filename="projects.csv"
          />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>New Project</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Project</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="projectNumber">Project Number</Label>
                <Input id="projectNumber" value={projectNumber} onChange={(e) => setProjectNumber(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Customer</Label>
                <Tabs value={customerType} onValueChange={(v) => { setCustomerType(v as typeof customerType); setCustomerId(""); }}>
                  <TabsList>
                    <TabsTrigger value="contact">Residential</TabsTrigger>
                    <TabsTrigger value="company">Commercial</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder={customerType === "contact" ? "Select a contact" : "Select a company"} />
                  </SelectTrigger>
                  <SelectContent>
                    {customerType === "contact"
                      ? contacts.data?.map((contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.firstName} {contact.lastName}
                          </SelectItem>
                        ))
                      : companies.data?.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="systemSizeKw">System Size (kW)</Label>
                  <Input id="systemSizeKw" type="number" value={systemSizeKw} onChange={(e) => setSystemSizeKw(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="panelCount">Panel Count</Label>
                  <Input id="panelCount" type="number" value={panelCount} onChange={(e) => setPanelCount(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contractAmount">Contract Amount</Label>
                <Input id="contractAmount" type="number" value={contractAmount} onChange={(e) => setContractAmount(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={!projectNumber || !systemSizeKw || !panelCount || !contractAmount || createProject.isPending}
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
        <TabsList>
          {STATUS_TABS.map((status) => (
            <TabsTrigger key={status} value={status}>
              {status.replaceAll("_", " ")}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <BulkActionsToolbar count={selectedIds.length} onClear={clearSelection}>
        <BulkTagSelect entityType="PROJECT" entityIds={selectedIds} onDone={clearSelection} />
        {isAdmin && (
          <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={deleteManyProjects.isPending}>
            Delete selected
          </Button>
        )}
      </BulkActionsToolbar>

      <Card className="bg-card border-border p-0 overflow-hidden">
        {projects.isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : projects.data?.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            No projects yet — create your first one.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                </TableHead>
                <TableHead>Project #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>System Size</TableHead>
                <TableHead>Financing</TableHead>
                <TableHead>Contract Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.data?.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <Checkbox
                      checked={isSelected(project.id)}
                      onCheckedChange={() => toggle(project.id)}
                      aria-label={`Select ${project.projectNumber}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Link href={`/projects/${project.id}`} className="font-medium hover:text-accent-foreground">
                      {project.projectNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {project.contact
                      ? `${project.contact.firstName} ${project.contact.lastName}`
                      : project.company
                        ? project.company.name
                        : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{Number(project.systemSizeKw)} kW</TableCell>
                  <TableCell className="text-muted-foreground">{project.financingType.replaceAll("_", " ")}</TableCell>
                  <TableCell className="text-muted-foreground">${Number(project.contractAmount).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[project.status] ?? "outline"}>{project.status.replaceAll("_", " ")}</Badge>
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
