"use client";

import Link from "next/link";
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

export default function ProjectCommissionsPage() {
  const summary = trpc.projectCommission.summary.useQuery();
  const commissions = trpc.projectCommission.list.useQuery({});

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">Commissions</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <TableHead>Project</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commissions.data?.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-card-foreground">
                    <Link href={`/projects/${c.projectId}`} className="hover:text-accent-foreground">
                      {c.project.projectNumber}
                    </Link>
                  </TableCell>
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
