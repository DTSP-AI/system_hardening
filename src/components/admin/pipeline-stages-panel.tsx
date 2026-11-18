"use client";

import { useState } from "react";
import { ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export function PipelineStagesPanel() {
  const utils = trpc.useUtils();
  const stages = trpc.pipelineStage.list.useQuery();

  const invalidate = () => utils.pipelineStage.list.invalidate();

  const createStage = trpc.pipelineStage.create.useMutation({
    onSuccess: () => {
      invalidate();
      setNewName("");
      toast.success("Stage added");
    },
    onError: (err) => toast.error(err.message),
  });
  const renameStage = trpc.pipelineStage.rename.useMutation({
    onSuccess: invalidate,
    onError: (err) => toast.error(err.message),
  });
  const reorderStage = trpc.pipelineStage.reorder.useMutation({
    onSuccess: invalidate,
    onError: (err) => toast.error(err.message),
  });
  const deleteStage = trpc.pipelineStage.delete.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Stage deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const [newName, setNewName] = useState("");

  const ordered = stages.data ?? [];

  function move(index: number, direction: -1 | 1) {
    const target = ordered[index + direction];
    const current = ordered[index];
    if (!target || !current) return;
    reorderStage.mutate({ id: current.id, sortOrder: target.sortOrder });
    reorderStage.mutate({ id: target.id, sortOrder: current.sortOrder });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder="New stage name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="max-w-64"
        />
        <Button
          onClick={() => createStage.mutate({ name: newName })}
          disabled={!newName || createStage.isPending}
        >
          Add stage
        </Button>
      </div>

      <Card className="bg-card border-border p-0 overflow-hidden">
        {stages.isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {ordered.map((stage, index) => (
              <div key={stage.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex flex-col">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                  >
                    <ArrowUp className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => move(index, 1)}
                    disabled={index === ordered.length - 1}
                  >
                    <ArrowDown className="size-3" />
                  </Button>
                </div>
                <Input
                  defaultValue={stage.name}
                  className="max-w-56"
                  onBlur={(e) => {
                    if (e.target.value && e.target.value !== stage.name) {
                      renameStage.mutate({ id: stage.id, name: e.target.value });
                    }
                  }}
                />
                {stage.isWon && <Badge>Won</Badge>}
                {stage.isLost && <Badge variant="destructive">Lost</Badge>}
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => deleteStage.mutate({ id: stage.id })}
                  disabled={deleteStage.isPending}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
