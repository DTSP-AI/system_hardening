"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { RouterOutputs } from "@/lib/trpc/types";

type Lead = RouterOutputs["lead"]["list"][number];
type LeadStatus = Lead["status"];

// CONVERTED is shown but is not a drop target and its cards are not draggable:
// conversion creates a Contact via lead.convert (the "Convert to Contact" button on
// the lead page), which setStatus does not do.
const COLUMNS: { status: LeadStatus; label: string; color: string }[] = [
  { status: "NEW", label: "New", color: "var(--viz-blue)" },
  { status: "CONTACTED", label: "Contacted", color: "var(--viz-aqua)" },
  { status: "QUALIFIED", label: "Qualified", color: "var(--viz-violet)" },
  { status: "UNQUALIFIED", label: "Unqualified", color: "var(--viz-orange)" },
  { status: "CONVERTED", label: "Converted", color: "var(--viz-yellow)" },
];

const STALE_MS = 14 * 24 * 60 * 60 * 1000;

function LeadCard({ lead }: { lead: Lead }) {
  const router = useRouter();
  const locked = lead.status === "CONVERTED";
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    disabled: locked,
  });
  const isStale =
    !locked && Date.now() - new Date(lead.updatedAt).getTime() > STALE_MS;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => router.push(`/leads/${lead.id}`)}
      style={{
        ...(transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
          : undefined),
        ...(isStale ? { borderLeftColor: "var(--warn)" } : undefined),
      }}
      className={cn(
        "rounded-lg border border-border bg-card p-3 transition-colors hover:border-accent-foreground/50",
        locked ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
        isStale && "border-l-2",
        isDragging && "opacity-40",
      )}
    >
      <p className="text-sm font-medium text-card-foreground">
        {lead.firstName} {lead.lastName}
      </p>
      {(lead.companyName || lead.jobTitle) && (
        <p className="mt-1 text-xs text-muted-foreground">
          {[lead.jobTitle, lead.companyName].filter(Boolean).join(" · ")}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between">
        <p className="mono-num text-xs text-muted-foreground">{lead.phone ?? lead.email ?? "—"}</p>
        {isStale && (
          <span className="text-[10px] font-medium tracking-wide text-(--warn) uppercase">
            Stale
          </span>
        )}
      </div>
    </div>
  );
}

function StatusColumn({
  column,
  leads,
}: {
  column: (typeof COLUMNS)[number];
  leads: Lead[];
}) {
  const droppable = column.status !== "CONVERTED";
  const { setNodeRef, isOver } = useDroppable({ id: column.status, disabled: !droppable });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl border border-border bg-card/50 transition-colors",
        isOver && "border-accent-foreground/60 bg-accent",
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ backgroundColor: column.color }} />
          <span className="text-sm font-semibold text-card-foreground">{column.label}</span>
          <span className="mono-num text-xs text-muted-foreground">{leads.length}</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} />
        ))}
        {leads.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            No leads
          </div>
        )}
      </div>
    </div>
  );
}

export default function LeadsBoardPage() {
  const utils = trpc.useUtils();
  const leads = trpc.lead.list.useQuery();
  const setStatus = trpc.lead.setStatus.useMutation({
    onError: (err) => toast.error(err.message),
    onSettled: () => utils.lead.list.invalidate(),
  });

  const [activeLead, setActiveLead] = useState<Lead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveLead(leads.data?.find((l) => l.id === event.active.id) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveLead(null);
    const { active, over } = event;
    if (!over) return;

    const leadId = active.id as string;
    const newStatus = over.id as LeadStatus;
    const lead = leads.data?.find((l) => l.id === leadId);
    if (!lead || lead.status === newStatus || newStatus === "CONVERTED") return;

    utils.lead.list.setData(undefined, (old) =>
      old?.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l)),
    );

    setStatus.mutate({ id: leadId, status: newStatus });
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5 text-sm">
            <Link href="/leads" className="rounded px-2.5 py-1 text-muted-foreground hover:text-foreground">
              List
            </Link>
            <span className="rounded bg-accent-foreground/15 px-2.5 py-1 font-medium text-accent-foreground">
              Board
            </span>
          </div>
        </div>
      </div>

      {leads.isLoading ? (
        <div className="flex gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-96 w-72 shrink-0" />
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
            {COLUMNS.map((column) => (
              <StatusColumn
                key={column.status}
                column={column}
                leads={leads.data?.filter((l) => l.status === column.status) ?? []}
              />
            ))}
          </div>
          <DragOverlay>
            {activeLead ? (
              <Card className="w-72 border-accent-foreground/60 bg-card p-3 shadow-lg">
                <p className="text-sm font-medium text-card-foreground">
                  {activeLead.firstName} {activeLead.lastName}
                </p>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
