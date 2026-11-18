"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { isInsuranceOrgSlug } from "@/lib/tenant-vertical";
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

type PolicyRow = RouterOutputs["policy"]["list"][number];

const POLICY_CSV_COLUMNS: CsvColumn<PolicyRow>[] = [
  { key: "policyNumber", label: "Policy #" },
  {
    key: "insured",
    label: "Insured",
    accessor: (p) =>
      p.contact ? `${p.contact.firstName} ${p.contact.lastName}` : p.company?.name,
  },
  { key: "lineOfBusiness", label: "Line of Business" },
  { key: "carrier", label: "Carrier", accessor: (p) => p.carrier.name },
  { key: "premium", label: "Premium" },
  { key: "effectiveDate", label: "Effective Date" },
  { key: "expirationDate", label: "Expiration Date" },
  { key: "status", label: "Status" },
];

const LINES_OF_BUSINESS = [
  "PERSONAL_AUTO",
  "HOMEOWNERS",
  "RENTERS",
  "CONDO",
  "DWELLING_FIRE",
  "PERSONAL_UMBRELLA",
  "MOTORCYCLE",
  "BOAT",
  "RV",
  "FLOOD",
  "COMMERCIAL_AUTO",
  "GENERAL_LIABILITY",
  "COMMERCIAL_PROPERTY",
  "BOP",
  "WORKERS_COMP",
  "COMMERCIAL_UMBRELLA",
  "PROFESSIONAL_LIABILITY",
  "CYBER",
  "INLAND_MARINE",
  "OTHER",
] as const;

const STATUS_TABS = ["ALL", "QUOTE", "ACTIVE", "PENDING_RENEWAL", "RENEWED", "CANCELLED", "NON_RENEWED", "EXPIRED"] as const;

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  QUOTE: "outline",
  ACTIVE: "default",
  PENDING_RENEWAL: "secondary",
  RENEWED: "secondary",
  CANCELLED: "destructive",
  NON_RENEWED: "destructive",
  EXPIRED: "outline",
};

export default function PoliciesPage() {
  const { orgSlug } = useAuth();
  const isFoundry = isInsuranceOrgSlug(orgSlug);
  const utils = trpc.useUtils();
  const { isAdmin } = useCurrentRole();
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_TABS)[number]>("ALL");
  const policies = trpc.policy.list.useQuery(
    statusFilter === "ALL" ? {} : { status: statusFilter },
    { enabled: isFoundry },
  );
  const carriers = trpc.carrier.list.useQuery(undefined, { enabled: isFoundry });
  const contacts = trpc.contact.list.useQuery();
  const companies = trpc.company.list.useQuery();

  const createPolicy = trpc.policy.create.useMutation({
    onSuccess: () => {
      utils.policy.list.invalidate();
      toast.success("Policy created");
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteManyPolicies = trpc.policy.deleteMany.useMutation({
    onSuccess: (result) => {
      utils.policy.list.invalidate();
      toast.success(`Deleted ${result.count} polic${result.count === 1 ? "y" : "ies"}`);
      clearSelection();
    },
    onError: (err) => toast.error(err.message),
  });

  const [open, setOpen] = useState(false);
  const [policyNumber, setPolicyNumber] = useState("");
  const [lineOfBusiness, setLineOfBusiness] = useState<string>("");
  const [carrierId, setCarrierId] = useState("");
  const [insuredType, setInsuredType] = useState<"contact" | "company">("contact");
  const [insuredId, setInsuredId] = useState("");
  const [premium, setPremium] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");

  function resetForm() {
    setPolicyNumber("");
    setLineOfBusiness("");
    setCarrierId("");
    setInsuredType("contact");
    setInsuredId("");
    setPremium("");
    setEffectiveDate("");
    setExpirationDate("");
  }

  function handleCreate() {
    if (!lineOfBusiness || !carrierId || !effectiveDate || !expirationDate) return;
    createPolicy.mutate(
      {
        policyNumber,
        lineOfBusiness: lineOfBusiness as (typeof LINES_OF_BUSINESS)[number],
        carrierId,
        contactId: insuredType === "contact" ? insuredId || undefined : undefined,
        companyId: insuredType === "company" ? insuredId || undefined : undefined,
        premium: Number(premium || 0),
        effectiveDate: new Date(effectiveDate),
        expirationDate: new Date(expirationDate),
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
  } = useRowSelection(policies.data);

  function handleBulkDelete() {
    if (!window.confirm(`Delete ${selectedIds.length} polic${selectedIds.length === 1 ? "y" : "ies"}? This cannot be undone.`)) return;
    deleteManyPolicies.mutate({ ids: selectedIds });
  }

  if (!isFoundry) {
    return (
      <p className="text-sm text-muted-foreground">
        Policies are only available to the Foundry Protects workspace.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Policies</h1>
        <div className="flex items-center gap-2">
          <ExportCsvButton
            data={policies.data}
            columns={POLICY_CSV_COLUMNS}
            filename="policies.csv"
          />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>New Policy</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Policy</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="policyNumber">Policy Number</Label>
                <Input id="policyNumber" value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Line of Business</Label>
                <Select value={lineOfBusiness} onValueChange={setLineOfBusiness}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a line of business" />
                  </SelectTrigger>
                  <SelectContent>
                    {LINES_OF_BUSINESS.map((lob) => (
                      <SelectItem key={lob} value={lob}>
                        {lob.replaceAll("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Carrier</Label>
                <Select value={carrierId} onValueChange={setCarrierId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a carrier" />
                  </SelectTrigger>
                  <SelectContent>
                    {carriers.data?.map((carrier) => (
                      <SelectItem key={carrier.id} value={carrier.id}>
                        {carrier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Insured</Label>
                <Tabs value={insuredType} onValueChange={(v) => { setInsuredType(v as typeof insuredType); setInsuredId(""); }}>
                  <TabsList>
                    <TabsTrigger value="contact">Personal</TabsTrigger>
                    <TabsTrigger value="company">Commercial</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Select value={insuredId} onValueChange={setInsuredId}>
                  <SelectTrigger>
                    <SelectValue placeholder={insuredType === "contact" ? "Select a contact" : "Select a company"} />
                  </SelectTrigger>
                  <SelectContent>
                    {insuredType === "contact"
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
                  <Label htmlFor="premium">Premium</Label>
                  <Input id="premium" type="number" value={premium} onChange={(e) => setPremium(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="effectiveDate">Effective Date</Label>
                  <Input id="effectiveDate" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="expirationDate">Expiration Date</Label>
                  <Input id="expirationDate" type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={!policyNumber || !lineOfBusiness || !carrierId || !effectiveDate || !expirationDate || createPolicy.isPending}
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
        <BulkTagSelect entityType="POLICY" entityIds={selectedIds} onDone={clearSelection} />
        {isAdmin && (
          <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={deleteManyPolicies.isPending}>
            Delete selected
          </Button>
        )}
      </BulkActionsToolbar>

      <Card className="bg-card border-border p-0 overflow-hidden">
        {policies.isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : policies.data?.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            No policies yet — create your first one.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                </TableHead>
                <TableHead>Policy #</TableHead>
                <TableHead>Insured</TableHead>
                <TableHead>Line of Business</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead>Premium</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.data?.map((policy) => (
                <TableRow key={policy.id}>
                  <TableCell>
                    <Checkbox
                      checked={isSelected(policy.id)}
                      onCheckedChange={() => toggle(policy.id)}
                      aria-label={`Select ${policy.policyNumber}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Link href={`/policies/${policy.id}`} className="font-medium hover:text-accent-foreground">
                      {policy.policyNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {policy.contact
                      ? `${policy.contact.firstName} ${policy.contact.lastName}`
                      : policy.company
                        ? policy.company.name
                        : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{policy.lineOfBusiness.replaceAll("_", " ")}</TableCell>
                  <TableCell className="text-muted-foreground">{policy.carrier.name}</TableCell>
                  <TableCell className="text-muted-foreground">${Number(policy.premium).toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(policy.expirationDate).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[policy.status] ?? "outline"}>{policy.status.replaceAll("_", " ")}</Badge>
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
