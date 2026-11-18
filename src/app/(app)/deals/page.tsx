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

type DealRow = RouterOutputs["deal"]["list"][number];

const DEAL_CSV_COLUMNS: CsvColumn<DealRow>[] = [
  { key: "name", label: "Name" },
  { key: "stage", label: "Stage", accessor: (d) => d.stage.name },
  { key: "amount", label: "Amount" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "source", label: "Source" },
  { key: "expectedCloseDate", label: "Expected Close Date" },
  { key: "contact", label: "Contact", accessor: (d) => d.contact ? `${d.contact.firstName} ${d.contact.lastName}` : "" },
  { key: "company", label: "Company", accessor: (d) => d.company?.name },
];

export default function DealsPage() {
  const utils = trpc.useUtils();
  const { isAdmin } = useCurrentRole();
  const deals = trpc.deal.list.useQuery();
  const stages = trpc.pipelineStage.list.useQuery();
  const createDeal = trpc.deal.create.useMutation({
    onSuccess: () => {
      utils.deal.list.invalidate();
      toast.success("Deal created");
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteManyDeals = trpc.deal.deleteMany.useMutation({
    onSuccess: (result) => {
      utils.deal.list.invalidate();
      toast.success(`Deleted ${result.count} deal${result.count === 1 ? "" : "s"}`);
      clearSelection();
    },
    onError: (err) => toast.error(err.message),
  });
  const moveStageMany = trpc.deal.moveStageMany.useMutation({
    onSuccess: (result) => {
      utils.deal.list.invalidate();
      toast.success(`Moved ${result.count} deal${result.count === 1 ? "" : "s"}`);
      clearSelection();
    },
    onError: (err) => toast.error(err.message),
  });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [stageId, setStageId] = useState<string>("");
  const [bulkStageId, setBulkStageId] = useState<string>("");

  function resetForm() {
    setName("");
    setAmount("");
    setStageId("");
  }

  function handleCreate() {
    if (!stageId) return;
    createDeal.mutate(
      { name, stageId, amount: amount ? Number(amount) : undefined },
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
  } = useRowSelection(deals.data);

  function handleBulkDelete() {
    if (!window.confirm(`Delete ${selectedIds.length} deal${selectedIds.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
    deleteManyDeals.mutate({ ids: selectedIds });
  }

  function handleBulkMoveStage() {
    if (!bulkStageId) return;
    moveStageMany.mutate({ ids: selectedIds, stageId: bulkStageId });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-foreground">Deals</h1>
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5 text-sm">
            <span className="rounded bg-accent-foreground/15 px-2.5 py-1 font-medium text-accent-foreground">List</span>
            <Link
              href="/deals/board"
              className="rounded px-2.5 py-1 text-muted-foreground hover:text-foreground"
            >
              Board
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportCsvButton data={deals.data} columns={DEAL_CSV_COLUMNS} filename="deals.csv" />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>New Deal</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Deal</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="amount">Amount (USD)</Label>
                <Input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Stage</Label>
                <Select value={stageId} onValueChange={setStageId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.data?.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={!name || !stageId || createDeal.isPending}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <BulkActionsToolbar count={selectedIds.length} onClear={clearSelection}>
        <Select value={bulkStageId} onValueChange={setBulkStageId}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Move to stage" />
          </SelectTrigger>
          <SelectContent>
            {stages.data?.map((stage) => (
              <SelectItem key={stage.id} value={stage.id}>
                {stage.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handleBulkMoveStage} disabled={!bulkStageId || moveStageMany.isPending}>
          Move
        </Button>
        <BulkTagSelect entityType="DEAL" entityIds={selectedIds} onDone={clearSelection} />
        {isAdmin && (
          <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={deleteManyDeals.isPending}>
            Delete selected
          </Button>
        )}
      </BulkActionsToolbar>

      <Card className="bg-card border-border p-0 overflow-hidden">
        {deals.isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : deals.data?.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            No deals yet — create your first one.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.data?.map((deal) => (
                <TableRow key={deal.id}>
                  <TableCell>
                    <Checkbox
                      checked={isSelected(deal.id)}
                      onCheckedChange={() => toggle(deal.id)}
                      aria-label={`Select ${deal.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Link href={`/deals/${deal.id}`} className="font-medium hover:text-accent-foreground">
                      {deal.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{deal.stage.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {deal.amount ? `$${Number(deal.amount).toLocaleString()}` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        deal.status === "WON"
                          ? "default"
                          : deal.status === "LOST"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {deal.status}
                    </Badge>
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
