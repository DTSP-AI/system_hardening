"use client";

import { Tag } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

type TaggableEntityType = "CONTACT" | "COMPANY" | "DEAL" | "LEAD" | "POLICY" | "PROJECT";

export function BulkTagSelect({
  entityType,
  entityIds,
  onDone,
}: {
  entityType: TaggableEntityType;
  entityIds: string[];
  onDone?: () => void;
}) {
  const tags = trpc.tag.list.useQuery();
  const assignMany = trpc.tag.assignMany.useMutation({
    onSuccess: (result) => {
      toast.success(`Tagged ${result.count} record${result.count === 1 ? "" : "s"}`);
      onDone?.();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Select
      value=""
      onValueChange={(tagId) => assignMany.mutate({ tagId, entityType, entityIds })}
    >
      <SelectTrigger className="w-40">
        <Tag className="size-3.5" />
        <SelectValue placeholder="Tag" />
      </SelectTrigger>
      <SelectContent>
        {tags.data?.map((tag) => (
          <SelectItem key={tag.id} value={tag.id}>
            {tag.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
