"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useCurrentRole } from "@/lib/hooks/use-current-role";
import { useRowSelection } from "@/lib/hooks/use-row-selection";
import { BulkActionsToolbar } from "@/components/shared/bulk-actions-toolbar";
import { BulkTagSelect } from "@/components/shared/bulk-tag-select";

export default function AccountsPage() {
  const utils = trpc.useUtils();
  const { isAdmin } = useCurrentRole();
  const accounts = trpc.account.list.useQuery();
  const deleteMany = trpc.account.deleteMany.useMutation({
    onSuccess: (result) => {
      utils.account.list.invalidate();
      toast.success(`Deleted ${result.count} account${result.count === 1 ? "" : "s"}`);
      clearSelection();
    },
    onError: (err) => toast.error(err.message),
  });

  const { isSelected, selectedIds, toggle, toggleAll, clear: clearSelection, allSelected } =
    useRowSelection(accounts.data);

  function handleBulkDelete() {
    if (!window.confirm(`Delete ${selectedIds.length} account${selectedIds.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
    deleteMany.mutate({ ids: selectedIds });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Accounts</h1>
      </div>

      <BulkActionsToolbar count={selectedIds.length} onClear={clearSelection}>
        <BulkTagSelect entityType="ACCOUNT" entityIds={selectedIds} onDone={clearSelection} />
        {isAdmin && (
          <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={deleteMany.isPending}>
            Delete selected
          </Button>
        )}
      </BulkActionsToolbar>

      <Card className="bg-card border-border p-0 overflow-hidden">
        {accounts.isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : accounts.data?.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            No accounts yet — convert a won deal to create one.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Contract value</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.data?.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>
                    <Checkbox
                      checked={isSelected(account.id)}
                      onCheckedChange={() => toggle(account.id)}
                      aria-label={`Select ${account.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Link href={`/accounts/${account.id}`} className="font-medium hover:text-accent-foreground">
                      {account.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {account.contact ? `${account.contact.firstName} ${account.contact.lastName}` : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {account.contractValue ? `$${Number(account.contractValue).toLocaleString()}` : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(account.startDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={account.status === "ACTIVE" ? "default" : "outline"}>{account.status}</Badge>
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
