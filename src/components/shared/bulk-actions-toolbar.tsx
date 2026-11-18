"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BulkActionsToolbar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: React.ReactNode;
}) {
  if (count === 0) return null;

  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-secondary/50 px-4 py-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{count}</span> selected
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="size-3.5" />
          Clear
        </Button>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
