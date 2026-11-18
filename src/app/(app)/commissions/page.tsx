"use client";

import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function CommissionsPage() {
  const summary = trpc.commission.summary.useQuery();
  const commissions = trpc.commission.list.useQuery({});

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">Commissions</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-card border-border p-6">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">This Month</span>
          {summary.isLoading ? (
            <Skeleton className="mt-2 h-8 w-24" />
          ) : (
            <p className="mt-2 text-2xl font-bold text-card-foreground">
              ${(summary.data?.monthTotal ?? 0).toLocaleString()}
            </p>
          )}
        </Card>
        <Card className="bg-card border-border p-6">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Year to Date</span>
          {summary.isLoading ? (
            <Skeleton className="mt-2 h-8 w-24" />
          ) : (
            <p className="mt-2 text-2xl font-bold text-card-foreground">
              ${(summary.data?.yearTotal ?? 0).toLocaleString()}
            </p>
          )}
        </Card>
        <Card className="bg-card border-border p-6">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">By Carrier (YTD)</span>
          <div className="mt-2 flex flex-col gap-1.5">
            {summary.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : summary.data?.byCarrier.length === 0 ? (
              <p className="text-sm text-muted-foreground">No commissions yet.</p>
            ) : (
              summary.data?.byCarrier.slice(0, 5).map((c) => (
                <div key={c.name} className="flex items-center justify-between text-sm">
                  <span className="text-card-foreground">{c.name}</span>
                  <span className="text-muted-foreground">${c.total.toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card className="bg-card border-border p-0 overflow-hidden">
        {commissions.isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : commissions.data?.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">No commissions logged yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Policy</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commissions.data?.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-card-foreground">{c.policy.policyNumber}</TableCell>
                  <TableCell className="text-muted-foreground">{c.policy.carrier.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.type.replaceAll("_", " ")}</TableCell>
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
    </div>
  );
}
