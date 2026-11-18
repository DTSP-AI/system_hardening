"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { isInsuranceOrgSlug } from "@/lib/tenant-vertical";
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
import { toast } from "sonner";

type ExpiringPolicy = {
  id: string;
  policyNumber: string;
  premium: unknown;
  expirationDate: Date | string;
  carrier: { name: string };
  contact: { firstName: string; lastName: string } | null;
  company: { name: string } | null;
};

function daysUntil(date: Date | string) {
  const ms = new Date(date).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function RenewalsTable({
  title,
  policies,
  onRenew,
  renewing,
}: {
  title: string;
  policies: ExpiringPolicy[];
  onRenew: (id: string) => void;
  renewing: boolean;
}) {
  return (
    <Card className="bg-card border-border p-0 overflow-hidden">
      <div className="px-6 py-4">
        <h2 className="text-sm font-semibold text-card-foreground">{title}</h2>
      </div>
      {policies.length === 0 ? (
        <div className="px-6 pb-6 text-sm text-muted-foreground">Nothing in this window.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Policy #</TableHead>
              <TableHead>Insured</TableHead>
              <TableHead>Carrier</TableHead>
              <TableHead>Premium</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {policies.map((policy) => (
              <TableRow key={policy.id}>
                <TableCell>
                  <Link href={`/policies/${policy.id}`} className="font-medium hover:text-accent-foreground">
                    {policy.policyNumber}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {policy.contact
                    ? `${policy.contact.firstName} ${policy.contact.lastName}`
                    : policy.company?.name ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{policy.carrier.name}</TableCell>
                <TableCell className="text-muted-foreground">${Number(policy.premium).toLocaleString()}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(policy.expirationDate).toLocaleDateString()} ({daysUntil(policy.expirationDate)}d)
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="secondary" disabled={renewing} onClick={() => onRenew(policy.id)}>
                    Renew
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

export default function RenewalsPage() {
  const { orgSlug } = useAuth();
  const isFoundry = isInsuranceOrgSlug(orgSlug);
  const utils = trpc.useUtils();
  const expiring = trpc.policy.expiringSoon.useQuery({ withinDays: 90 }, { enabled: isFoundry });

  const renew = trpc.policy.renew.useMutation({
    onSuccess: (renewed) => {
      utils.policy.expiringSoon.invalidate();
      toast.success(`Renewed as new policy ${renewed.policyNumber}`);
    },
    onError: (err) => toast.error(err.message),
  });

  if (!isFoundry) {
    return (
      <p className="text-sm text-muted-foreground">
        Renewals are only available to the Foundry Protects workspace.
      </p>
    );
  }

  if (expiring.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const policies = (expiring.data ?? []) as ExpiringPolicy[];
  const due30 = policies.filter((p) => daysUntil(p.expirationDate) <= 30);
  const due60 = policies.filter((p) => {
    const d = daysUntil(p.expirationDate);
    return d > 30 && d <= 60;
  });
  const due90 = policies.filter((p) => {
    const d = daysUntil(p.expirationDate);
    return d > 60 && d <= 90;
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">Renewals</h1>
      <RenewalsTable title="Due in 30 days" policies={due30} onRenew={(id) => renew.mutate({ id })} renewing={renew.isPending} />
      <RenewalsTable title="31–60 days" policies={due60} onRenew={(id) => renew.mutate({ id })} renewing={renew.isPending} />
      <RenewalsTable title="61–90 days" policies={due90} onRenew={(id) => renew.mutate({ id })} renewing={renew.isPending} />
    </div>
  );
}
