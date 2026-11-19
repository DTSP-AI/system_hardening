"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { X } from "lucide-react";
import type { RouterOutputs } from "@/lib/trpc/types";

type Todo = RouterOutputs["todo"]["list"][number];
type Quadrant = Todo["quadrant"];

const QUADRANTS: { key: Quadrant; label: string; hint: string; chip: string }[] = [
  {
    key: "URGENT_IMPORTANT",
    label: "Urgent & Important",
    hint: "Do first",
    chip: "var(--viz-orange)",
  },
  { key: "SCHEDULE", label: "Schedule", hint: "Plan for it", chip: "var(--viz-blue)" },
  { key: "DELEGATE", label: "Delegate", hint: "Hand it off", chip: "var(--viz-aqua)" },
  { key: "BACK_BURNER", label: "Back Burner", hint: "Someday", chip: "var(--viz-violet)" },
];

function QuadrantColumn({
  quadrant,
  label,
  hint,
  chip,
  todos,
}: {
  quadrant: Quadrant;
  label: string;
  hint: string;
  chip: string;
  todos: Todo[];
}) {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState("");

  const create = trpc.todo.create.useMutation({
    onSuccess: () => {
      setTitle("");
      utils.todo.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const toggle = trpc.todo.toggle.useMutation({
    onSuccess: () => utils.todo.list.invalidate(),
    onError: (err) => toast.error(err.message),
  });
  const move = trpc.todo.move.useMutation({
    onSuccess: () => utils.todo.list.invalidate(),
    onError: (err) => toast.error(err.message),
  });
  const remove = trpc.todo.delete.useMutation({
    onSuccess: () => utils.todo.list.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim() || create.isPending) return;
          create.mutate({ title: title.trim(), quadrant });
        }}
      >
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: chip }} />
        <span className="shrink-0 text-xs font-medium text-card-foreground">{label}</span>
        <span className="hidden shrink-0 text-[11px] font-normal text-muted-foreground sm:inline">
          · {hint}
        </span>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task…"
          className="h-7 w-full basis-full text-xs"
        />
        <Button type="submit" size="sm" disabled={!title.trim() || create.isPending}>
          Add
        </Button>
      </form>

      <div className="flex flex-col">
        {todos.length === 0 && (
          <p className="py-0.5 text-[11px] text-muted-foreground">Nothing here.</p>
        )}
        {todos.map((todo) => (
          <div
            key={todo.id}
            className="group flex items-center gap-2 rounded-md px-2 py-0.5 hover:bg-sidebar-accent/40"
          >
            <Checkbox
              checked={todo.completed}
              onCheckedChange={(checked) =>
                toggle.mutate({ id: todo.id, completed: checked === true })
              }
            />
            <span
              className={
                "flex-1 truncate text-xs " +
                (todo.completed ? "text-muted-foreground line-through" : "text-card-foreground")
              }
            >
              {todo.title}
            </span>
            <Select
              value={todo.quadrant}
              onValueChange={(value) => move.mutate({ id: todo.id, quadrant: value as Quadrant })}
            >
              <SelectTrigger
                size="sm"
                className="hidden h-6 w-6 shrink-0 border-none bg-transparent p-0 text-transparent group-hover:flex [&_svg]:mx-auto [&_svg]:text-muted-foreground"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUADRANTS.map((q) => (
                  <SelectItem key={q.key} value={q.key}>
                    {q.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={() => remove.mutate({ id: todo.id })}
              className="hidden shrink-0 text-muted-foreground hover:text-destructive group-hover:block"
              aria-label="Delete task"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TodoBoard() {
  const todos = trpc.todo.list.useQuery();

  if (todos.isLoading) {
    return (
      <Card size="sm">
        <CardContent className="flex flex-col gap-3">
          {QUADRANTS.map((q) => (
            <Skeleton key={q.key} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const byQuadrant = (quadrant: Quadrant) =>
    (todos.data ?? []).filter((t) => t.quadrant === quadrant);

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-xs! font-semibold tracking-wide text-muted-foreground uppercase">
          Eisenhower Priority Matrix
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
        {QUADRANTS.map((q) => (
          <div key={q.key} className="rounded-lg border border-border p-3">
            <QuadrantColumn
              quadrant={q.key}
              label={q.label}
              hint={q.hint}
              chip={q.chip}
              todos={byQuadrant(q.key)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
