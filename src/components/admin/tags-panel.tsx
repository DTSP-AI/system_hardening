"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const TAG_COLORS = [
  "var(--viz-blue)",
  "var(--viz-aqua)",
  "var(--viz-yellow)",
  "var(--viz-violet)",
  "var(--viz-orange)",
];

export function TagsPanel() {
  const utils = trpc.useUtils();
  const tags = trpc.tag.list.useQuery();
  const [newName, setNewName] = useState("");
  const [color, setColor] = useState(TAG_COLORS[0]);

  const createTag = trpc.tag.create.useMutation({
    onSuccess: () => {
      utils.tag.list.invalidate();
      setNewName("");
      toast.success("Tag added");
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteTag = trpc.tag.delete.useMutation({
    onSuccess: () => {
      utils.tag.list.invalidate();
      toast.success("Tag deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder="New tag name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="max-w-64"
        />
        <div className="flex items-center gap-1">
          {TAG_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="size-6 shrink-0 rounded-full"
              style={{
                backgroundColor: c,
                outline: color === c ? "2px solid var(--foreground)" : "none",
                outlineOffset: 2,
              }}
            />
          ))}
        </div>
        <Button
          onClick={() => createTag.mutate({ name: newName, color })}
          disabled={!newName || createTag.isPending}
        >
          Add tag
        </Button>
      </div>

      <Card className="bg-card border-border p-0 overflow-hidden">
        {tags.isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : tags.data?.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">No tags yet.</div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {tags.data?.map((tag) => (
              <div key={tag.id} className="flex items-center gap-3 px-4 py-3">
                <Badge
                  style={{
                    backgroundColor: `color-mix(in oklab, ${tag.color} 22%, transparent)`,
                    color: tag.color,
                  }}
                >
                  {tag.name}
                </Badge>
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => deleteTag.mutate({ id: tag.id })}
                  disabled={deleteTag.isPending}
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
