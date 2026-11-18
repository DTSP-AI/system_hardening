"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function MyTasks() {
  const utils = trpc.useUtils();
  const tasks = trpc.activity.myTasks.useQuery();
  const completeActivity = trpc.activity.complete.useMutation({
    onSuccess: () => utils.activity.myTasks.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  return (
    <Card className="bg-card border-border p-0 overflow-hidden">
      {tasks.isLoading ? (
        <div className="flex flex-col gap-2 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : tasks.data?.length === 0 ? (
        <div className="p-10 text-center text-muted-foreground">
          No tasks — add one from a contact or deal&apos;s activity timeline.
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {tasks.data?.map((task) => {
            const overdue =
              !task.completedAt && task.dueDate && new Date(task.dueDate) < new Date();
            const related = task.contact
              ? { label: `${task.contact.firstName} ${task.contact.lastName}`, href: `/contacts/${task.contactId}` }
              : task.deal
                ? { label: task.deal.name, href: `/deals/${task.dealId}` }
                : null;

            return (
              <div key={task.id} className="flex items-start gap-3 p-4">
                <Checkbox
                  className="mt-0.5"
                  checked={!!task.completedAt}
                  disabled={!!task.completedAt || completeActivity.isPending}
                  onCheckedChange={() => completeActivity.mutate({ id: task.id })}
                />
                <div className="flex flex-1 flex-col gap-1">
                  <p
                    className={cn(
                      "text-sm",
                      task.completedAt ? "text-muted-foreground line-through" : "text-card-foreground",
                    )}
                  >
                    {task.body}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {related && (
                      <Link href={related.href} className="hover:text-accent">
                        {related.label}
                      </Link>
                    )}
                    {task.dueDate && <span>Due {new Date(task.dueDate).toLocaleDateString()}</span>}
                    {overdue && <Badge variant="destructive">Overdue</Badge>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
