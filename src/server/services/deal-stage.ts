import { TRPCError } from "@trpc/server";
import { Prisma } from "@generated/prisma/client";
import type { Account, Deal, PipelineStage } from "@generated/prisma/client";
import type { DbTx } from "@/lib/db";
import { logAudit, toJsonSafe } from "@/lib/audit";
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
 * Locks the given deal rows until the caller's transaction ends. A stage move
 * and a conversion to an account both take this lock first, so one always
 * sees the other's committed result: a deal cannot be reopened while it is
 * being converted, or converted while it is being moved out of Won.
 */
async function lockDeals(db: DbTx, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.$queryRaw`SELECT "id" FROM "deals" WHERE "id" IN (${Prisma.join([...ids])}) ORDER BY "id" FOR UPDATE`;
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

  await lockDeals(db, ids);

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

/**
 * Turns a Won deal into an account. Idempotent: a deal that already has an
 * account returns it. Takes the same row lock as a stage move. Must run inside
 * the caller's transaction.
 */
export async function convertDealToAccount(
  db: DbTx,
  params: { actorId: string; dealId: string },
): Promise<Account> {
  await lockDeals(db, [params.dealId]);

  const deal = await db.deal.findUnique({
    where: { id: params.dealId },
    include: { company: true, account: true },
  });
  if (!deal) throw new TRPCError({ code: "NOT_FOUND", message: "Deal not found" });
  if (deal.account) return deal.account;
  if (deal.status !== "WON") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Only won deals can be converted to an account" });
  }

  const account = await db.account.create({
    data: {
      name: deal.company?.name ?? deal.name,
      contractValue: deal.amount,
      sourceDealId: deal.id,
      companyId: deal.companyId,
      contactId: deal.contactId,
      ownerId: deal.ownerId,
    },
  });
  await logAudit(db, {
    actorId: params.actorId,
    entityType: "ACCOUNT",
    entityId: account.id,
    action: "CREATE",
    diff: toJsonSafe(account),
  });
  return account;
}
