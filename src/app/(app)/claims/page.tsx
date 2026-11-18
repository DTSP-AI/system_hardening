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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  OPEN: "default",
  CLOSED: "secondary",
  DENIED: "destructive",
  REOPENED: "outline",
};

export default function ClaimsPage() {
  const { orgSlug } = useAuth();
  const isFoundry = isInsuranceOrgSlug(orgSlug);
  const utils = trpc.useUtils();
  const claims = trpc.claim.list.useQuery(undefined, { enabled: isFoundry });
  const policies = trpc.policy.list.useQuery({}, { enabled: isFoundry });
  const createClaim = trpc.claim.create.useMutation({
    onSuccess: () => {
      utils.claim.list.invalidate();
      toast.success("Claim created");
    },
    onError: (err) => toast.error(err.message),
  });

  const [open, setOpen] = useState(false);
  const [policyId, setPolicyId] = useState("");
  const [claimNumber, setClaimNumber] = useState("");
  const [dateOfLoss, setDateOfLoss] = useState("");
  const [description, setDescription] = useState("");

  function resetForm() {
    setPolicyId("");
    setClaimNumber("");
    setDateOfLoss("");
    setDescription("");
  }

  function handleCreate() {
    if (!policyId || !dateOfLoss) return;
    createClaim.mutate(
      {
        policyId,
        claimNumber,
        dateOfLoss: new Date(dateOfLoss),
        description: description || undefined,
      },
      { onSuccess: () => { setOpen(false); resetForm(); } },
    );
  }

  if (!isFoundry) {
    return (
      <p className="text-sm text-muted-foreground">
        Claims are only available to the Foundry Protects workspace.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Claims</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>New Claim</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Claim</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Policy</Label>
                <Select value={policyId} onValueChange={setPolicyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a policy" />
                  </SelectTrigger>
                  <SelectContent>
                    {policies.data?.map((policy) => (
                      <SelectItem key={policy.id} value={policy.id}>
                        {policy.policyNumber} — {policy.carrier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="claimNumber">Claim Number</Label>
                <Input id="claimNumber" value={claimNumber} onChange={(e) => setClaimNumber(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dateOfLoss">Date of Loss</Label>
                <Input id="dateOfLoss" type="date" value={dateOfLoss} onChange={(e) => setDateOfLoss(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">Description</Label>
                <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={!policyId || !claimNumber || !dateOfLoss || createClaim.isPending}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-card border-border p-0 overflow-hidden">
        {claims.isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : claims.data?.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            No claims yet — create your first one.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Claim #</TableHead>
                <TableHead>Policy</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead>Date of Loss</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.data?.map((claim) => (
                <TableRow key={claim.id}>
                  <TableCell className="font-medium text-card-foreground">{claim.claimNumber}</TableCell>
                  <TableCell>
                    <Link href={`/policies/${claim.policyId}`} className="text-muted-foreground hover:text-accent-foreground">
                      {claim.policy.policyNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{claim.policy.carrier.name}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(claim.dateOfLoss).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[claim.status] ?? "outline"}>{claim.status}</Badge>
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
