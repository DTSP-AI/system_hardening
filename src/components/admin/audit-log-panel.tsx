"use client";

import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const ACTION_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  CREATE: "secondary",
  UPDATE: "default",
  DELETE: "destructive",
};

export function AuditLogPanel() {
  const logs = trpc.auditLog.list.useQuery();

  return (
    <Card className="bg-card border-border p-0 overflow-hidden">
      {logs.isLoading ? (
        <div className="flex flex-col gap-2 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : logs.data?.length === 0 ? (
        <div className="p-10 text-center text-muted-foreground">No audit activity yet.</div>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {logs.data?.map((log) => (
            <div key={log.id} className="flex items-center gap-3 px-4 py-3">
              <Badge variant={ACTION_VARIANT[log.action] ?? "outline"}>{log.action}</Badge>
              <span className="text-sm text-card-foreground">
                {log.entityType.replaceAll("_", " ")}
              </span>
              <span className="text-xs text-muted-foreground">{log.entityId}</span>
              <div className="flex-1" />
              <span className="shrink-0 text-xs text-muted-foreground">
                {new Date(log.createdAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
