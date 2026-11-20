import { TRPCError } from "@trpc/server";
import type { Deal, PipelineStage } from "@generated/prisma/client";
import type { DbTx } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";

/**
 * The one owner of a deal's stage, status and close date. Every stage change
 * (tRPC or MCP) goes through here; nothing else writes Deal.stageId.
 */

export type DealStageFields = {
  stageId: string;
  status: "OPEN" | "WON" | "LOST";
  closedAt: Date | null;
};

/** Pure: the status and close date a deal has while it sits in `stage`. */
export function stageFields(
  stage: Pick<PipelineStage, "id" | "isWon" | "isLost">,
  now: Date = new Date(),
): DealStageFields {
  const closed = stage.isWon || stage.isLost;
  return {
    stageId: stage.id,
    status: stage.isWon ? "WON" : stage.isLost ? "LOST" : "OPEN",
    closedAt: closed ? now : null,
  };
}

/** Stage fields for a deal being created in `stageId`. */
export async function stageFieldsForCreate(db: DbTx, stageId: string): Promise<DealStageFields> {
  const stage = await db.pipelineStage.findUnique({ where: { id: stageId } });
  if (!stage) throw new TRPCError({ code: "NOT_FOUND", message: "Pipeline stage not found" });
  return stageFields(stage);
}

/**
 * Moves one or more deals to a stage and returns the deals that moved. All or
 * nothing: if any deal is already converted to an account, nothing changes.
 * Ids that match no deal are skipped. Must run inside the caller's transaction
 * so the audit rows commit with the moves.
 */
export async function changeDealStage(
  db: DbTx,
  params: { actorId: string; dealIds: readonly string[]; stageId: string },
): Promise<Deal[]> {
  const ids = [...new Set(params.dealIds)];

  const stage = await db.pipelineStage.findUnique({ where: { id: params.stageId } });
  if (!stage) throw new TRPCError({ code: "NOT_FOUND", message: "Pipeline stage not found" });

  const converted = await db.account.findFirst({
    where: { sourceDealId: { in: ids } },
    select: { id: true },
  });
  if (converted) {
    throw new TRPCError({
      code: "CONFLICT",
      message:
        ids.length === 1
          ? "This deal was converted to an account and can no longer change stage"
          : "A selected deal was converted to an account and can no longer change stage",
    });
  }

  const fields = stageFields(stage);
  await db.deal.updateMany({ where: { id: { in: ids } }, data: fields });
  const moved = await db.deal.findMany({ where: { id: { in: ids } } });

  for (const deal of moved) {
    await logAudit(db, {
      actorId: params.actorId,
      entityType: "DEAL",
      entityId: deal.id,
      action: "UPDATE",
      diff: { stageId: fields.stageId, status: fields.status },
    });
    if (deal.ownerId && deal.ownerId !== params.actorId) {
      await notify(db, {
        userId: deal.ownerId,
        type: "DEAL_STAGE_CHANGE",
        title: `${deal.name} moved to ${stage.name}`,
        linkHref: `/deals/${deal.id}`,
      });
    }
  }
  return moved;
}
