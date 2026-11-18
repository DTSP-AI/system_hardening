"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ExportCsvButton } from "@/components/shared/export-csv-button";
import { useCurrentRole } from "@/lib/hooks/use-current-role";
import { useRowSelection } from "@/lib/hooks/use-row-selection";
import { BulkActionsToolbar } from "@/components/shared/bulk-actions-toolbar";
import type { CsvColumn } from "@/lib/csv";
import type { RouterOutputs } from "@/lib/trpc/types";

const INDUSTRIES = [
  "HVAC",
  "Plumbing",
  "Electrical",
  "Roofing",
  "General Contractor",
  "Pest Control",
  "Landscaping",
  "Dental",
  "Veterinary",
  "Real Estate",
];

type Prospect = RouterOutputs["prospecting"]["search"][number];

const PROSPECT_CSV_COLUMNS: CsvColumn<Prospect>[] = [
  { key: "businessName", label: "Business Name" },
  { key: "address", label: "Address" },
  { key: "phone", label: "Phone" },
  { key: "category", label: "Category" },
  { key: "rating", label: "Rating" },
  { key: "ownerName", label: "Owner Name" },
  { key: "ownerEmail", label: "Owner Email" },
];

export default function ProspectingPage() {
  const utils = trpc.useUtils();
  const { isAdmin } = useCurrentRole();

  const [location, setLocation] = useState("");
  const [industry, setIndustry] = useState(INDUSTRIES[0]);
  const [radiusMiles, setRadiusMiles] = useState(25);
  const [tier, setTier] = useState<"basic" | "premium">("basic");
  const [hasSearched, setHasSearched] = useState(false);

  const results = trpc.prospecting.search.useQuery(
    { location, industry, radiusMiles, tier },
    { enabled: false },
  );

  function handleSearch() {
    if (!location.trim()) {
      toast.error("Enter a location to search");
      return;
    }
    setHasSearched(true);
    results.refetch();
  }

  const createLead = trpc.lead.create.useMutation({
    onSuccess: () => {
      utils.lead.list.invalidate();
      toast.success("Added to leads");
    },
    onError: (err) => toast.error(err.message),
  });

  const bulkCreateLeads = trpc.lead.bulkCreate.useMutation({
    onSuccess: (result) => {
      utils.lead.list.invalidate();
      toast.success(`Added ${result.count} lead${result.count === 1 ? "" : "s"}`);
      clearSelection();
    },
    onError: (err) => toast.error(err.message),
  });

  function prospectToLeadInput(p: Prospect) {
    return {
      firstName: "Business",
      lastName: p.businessName,
      companyName: p.businessName,
      phone: p.phone,
      source: "Prospecting",
    };
  }

  function handleAddToLeads(p: Prospect) {
    createLead.mutate(prospectToLeadInput(p));
  }

  function handleBulkAddToLeads() {
    const rows = selectedIds
      .map((id) => results.data?.find((p) => p.id === id))
      .filter((p): p is Prospect => !!p)
      .map(prospectToLeadInput);
    if (rows.length === 0) return;
    bulkCreateLeads.mutate({ rows });
  }

  const {
    isSelected,
    selectedIds,
    toggle,
    toggleAll,
    clear: clearSelection,
    allSelected,
  } = useRowSelection(results.data);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Prospecting</h1>
        <ExportCsvButton data={results.data} columns={PROSPECT_CSV_COLUMNS} filename="prospects.csv" />
      </div>

      <Card className="bg-card border-border p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="City, State or ZIP"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-48"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Industry</Label>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((i) => (
                  <SelectItem key={i} value={i}>
                    {i}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="radius">Radius (mi)</Label>
            <Input
              id="radius"
              type="number"
              min={1}
              max={100}
              value={radiusMiles}
              onChange={(e) => setRadiusMiles(Number(e.target.value) || 25)}
              className="w-24"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Tier</Label>
            <Select value={tier} onValueChange={(v) => setTier(v as "basic" | "premium")}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Basic — business + phone</SelectItem>
                <SelectItem value="premium">Premium — + owner contact</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSearch} disabled={results.isFetching}>
            Search
          </Button>
        </div>
      </Card>

      <BulkActionsToolbar count={selectedIds.length} onClear={clearSelection}>
        {isAdmin && (
          <Button size="sm" onClick={handleBulkAddToLeads} disabled={bulkCreateLeads.isPending}>
            Add selected to Leads
          </Button>
        )}
      </BulkActionsToolbar>

      <Card className="bg-card border-border p-0 overflow-hidden">
        {!hasSearched ? (
          <div className="p-10 text-center text-muted-foreground">
            Enter a location and industry to find local businesses to call.
          </div>
        ) : results.isFetching ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : results.data?.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            No businesses found for that search.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                </TableHead>
                <TableHead>Business</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Rating</TableHead>
                {tier === "premium" && <TableHead>Owner</TableHead>}
                {tier === "premium" && <TableHead>Owner Email</TableHead>}
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.data?.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Checkbox
                      checked={isSelected(p.id)}
                      onCheckedChange={() => toggle(p.id)}
                      aria-label={`Select ${p.businessName}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{p.businessName}</TableCell>
                  <TableCell className="text-muted-foreground">{p.address}</TableCell>
                  <TableCell className="text-muted-foreground">{p.phone}</TableCell>
                  <TableCell className="text-muted-foreground">{p.category}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {p.rating.toFixed(1)} ({p.reviewCount})
                    </Badge>
                  </TableCell>
                  {tier === "premium" && (
                    <TableCell className="text-muted-foreground">{p.ownerName ?? "—"}</TableCell>
                  )}
                  {tier === "premium" && (
                    <TableCell className="text-muted-foreground">{p.ownerEmail ?? "—"}</TableCell>
                  )}
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddToLeads(p)}
                      disabled={createLead.isPending}
                    >
                      Add to Lead
                    </Button>
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
