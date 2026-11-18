"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { RouterOutputs } from "@/lib/trpc/types";

type Deal = RouterOutputs["deal"]["list"][number];

const STALE_MS = 14 * 24 * 60 * 60 * 1000;

function DealCard({ deal }: { deal: Deal }) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
  });
  const isStale = Date.now() - new Date(deal.updatedAt).getTime() > STALE_MS;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => router.push(`/deals/${deal.id}`)}
      style={{
        ...(transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
          : undefined),
        ...(isStale ? { borderLeftColor: "var(--warn)" } : undefined),
      }}
      className={cn(
        "cursor-grab rounded-lg border border-border bg-card p-3 transition-colors active:cursor-grabbing hover:border-accent-foreground/50",
        isStale && "border-l-2",
        isDragging && "opacity-40",
      )}
    >
      <p className="text-sm font-medium text-card-foreground">{deal.name}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {deal.company?.name ?? deal.contact ? `${deal.contact?.firstName ?? ""} ${deal.contact?.lastName ?? ""}`.trim() : null}
      </p>
      <div className="mt-2 flex items-center justify-between">
        <p className="mono-num text-sm font-semibold text-accent-foreground">
          {deal.amount ? `$${Number(deal.amount).toLocaleString()}` : "—"}
        </p>
        {isStale && (
          <span className="text-[10px] font-medium tracking-wide text-(--warn) uppercase">
            Stale
          </span>
        )}
      </div>
    </div>
  );
}

function StageColumn({
  stage,
  deals,
}: {
  stage: RouterOutputs["pipelineStage"]["list"][number];
  deals: Deal[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const total = deals.reduce((sum, d) => sum + (d.amount ? Number(d.amount) : 0), 0);

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
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          <span className="text-sm font-semibold text-card-foreground">{stage.name}</span>
          <span className="mono-num text-xs text-muted-foreground">{deals.length}</span>
        </div>
      </div>
      <div className="mono-num border-b border-border px-3 py-1.5 text-xs text-muted-foreground">
        ${total.toLocaleString()}
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3 pt-1">
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} />
        ))}
        {deals.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            No deals
          </div>
        )}
      </div>
    </div>
  );
}

export default function DealsBoardPage() {
  const utils = trpc.useUtils();
  const deals = trpc.deal.list.useQuery();
  const stages = trpc.pipelineStage.list.useQuery();
  const moveStage = trpc.deal.moveStage.useMutation({
    onSettled: () => utils.deal.list.invalidate(),
  });

  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  function handleDragStart(event: DragStartEvent) {
    const deal = deals.data?.find((d) => d.id === event.active.id);
    setActiveDeal(deal ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDeal(null);
    const { active, over } = event;
    if (!over) return;

    const dealId = active.id as string;
    const newStageId = over.id as string;
    const deal = deals.data?.find((d) => d.id === dealId);
    const newStage = stages.data?.find((s) => s.id === newStageId);
    if (!deal || !newStage || deal.stageId === newStageId) return;

    utils.deal.list.setData(undefined, (old) =>
      old?.map((d) =>
        d.id === dealId
          ? {
              ...d,
              stageId: newStageId,
              stage: newStage,
              status: newStage.isWon ? "WON" : newStage.isLost ? "LOST" : "OPEN",
            }
          : d,
      ),
    );

    moveStage.mutate({ id: dealId, stageId: newStageId });
  }

  const isLoading = deals.isLoading || stages.isLoading;

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Deals</h1>
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5 text-sm">
          <Link href="/deals" className="rounded px-2.5 py-1 text-muted-foreground hover:text-foreground">
            List
          </Link>
          <span className="rounded bg-accent-foreground/15 px-2.5 py-1 font-medium text-accent-foreground">Board</span>
        </div>
      </div>

      {isLoading ? (
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
            {stages.data?.map((stage) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                deals={deals.data?.filter((d) => d.stageId === stage.id) ?? []}
              />
            ))}
          </div>
          <DragOverlay>
            {activeDeal ? (
              <Card className="w-72 border-accent-foreground/60 bg-card p-3 shadow-lg">
                <p className="text-sm font-medium text-card-foreground">{activeDeal.name}</p>
                <p className="mono-num mt-2 text-sm font-semibold text-accent-foreground">
                  {activeDeal.amount ? `$${Number(activeDeal.amount).toLocaleString()}` : "—"}
                </p>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
