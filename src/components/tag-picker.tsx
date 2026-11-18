"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const TAG_COLORS = [
  "var(--viz-blue)",
  "var(--viz-aqua)",
  "var(--viz-yellow)",
  "var(--viz-violet)",
  "var(--viz-orange)",
];

type EntityType = "CONTACT" | "COMPANY" | "DEAL" | "LEAD" | "POLICY" | "PROJECT";

export function TagPicker({ entityType, entityId }: { entityType: EntityType; entityId: string }) {
  const utils = trpc.useUtils();
  const [newTagName, setNewTagName] = useState("");

  const allTags = trpc.tag.list.useQuery();
  const assigned = trpc.tag.forEntity.useQuery({ entityType, entityId });

  const invalidate = () => {
    utils.tag.forEntity.invalidate({ entityType, entityId });
    utils.tag.list.invalidate();
  };

  const assign = trpc.tag.assign.useMutation({
    onSuccess: invalidate,
    onError: (err) => toast.error(err.message),
  });
  const unassign = trpc.tag.unassign.useMutation({
    onSuccess: invalidate,
    onError: (err) => toast.error(err.message),
  });
  const createTag = trpc.tag.create.useMutation({
    onSuccess: (tag) => {
      setNewTagName("");
      assign.mutate({ tagId: tag.id, entityType, entityId });
    },
    onError: (err) => toast.error(err.message),
  });

  const assignedIds = new Set(assigned.data?.map((a) => a.tagId));

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">Tags</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {assigned.data?.map((a) => (
          <Badge
            key={a.id}
            className="cursor-pointer gap-1"
            style={{ backgroundColor: `color-mix(in oklab, ${a.tag.color} 22%, transparent)`, color: a.tag.color }}
            onClick={() => unassign.mutate({ id: a.id })}
          >
            {a.tag.name}
            <span className="opacity-60">×</span>
          </Badge>
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon-sm" className="size-6">
              <Plus className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Tags</DropdownMenuLabel>
            {allTags.data?.map((tag) => (
              <DropdownMenuCheckboxItem
                key={tag.id}
                checked={assignedIds.has(tag.id)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    assign.mutate({ tagId: tag.id, entityType, entityId });
                  } else {
                    const assignment = assigned.data?.find((a) => a.tagId === tag.id);
                    if (assignment) unassign.mutate({ id: assignment.id });
                  }
                }}
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <div className="flex items-center gap-1 p-1.5">
              <Input
                placeholder="New tag…"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="h-7 text-xs"
              />
              <Button
                size="icon-sm"
                className="size-7 shrink-0"
                disabled={!newTagName || createTag.isPending}
                onClick={() =>
                  createTag.mutate({
                    name: newTagName,
                    color: TAG_COLORS[(allTags.data?.length ?? 0) % TAG_COLORS.length],
                  })
                }
              >
                <Plus className="size-3" />
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
