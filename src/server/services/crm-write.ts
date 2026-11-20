import { TRPCError } from "@trpc/server";
import type { Activity, Lead } from "@generated/prisma/client";
import type { DbTx } from "@/lib/db";
import { logAudit, toJsonSafe } from "@/lib/audit";
import { entityExists } from "@/lib/attachments/entity";
import { activityParentField, type ActivityParentType } from "@/server/services/crm-read";

/**
 * Writes available to machine clients (the MCP tools), each with its audit
 * row. Run inside the caller's transaction. Stage changes and conversion are
 * not here: they are deal-stage.ts and lead-convert.ts, shared with the UI.
 */

export type CreateLeadInput = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  companyName?: string;
  jobTitle?: string;
  source?: string;
};

export async function createLead(db: DbTx, actorId: string, input: CreateLeadInput): Promise<Lead> {
  const created = await db.lead.create({ data: { ...input } });
  await logAudit(db, {
    actorId,
    entityType: "LEAD",
    entityId: created.id,
    action: "CREATE",
    diff: toJsonSafe(created),
  });
  return created;
}

export type LogActivityInput = {
  type: "NOTE" | "TASK";
  entityType: ActivityParentType;
  entityId: string;
  body: string;
  dueDate?: Date;
};

/** Logs a note or a task on a record. Calls, emails and meetings are created by their own flows. */
export async function logActivity(db: DbTx, actorId: string, input: LogActivityInput): Promise<Activity> {
  if (!(await entityExists(db, input.entityType, input.entityId))) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Record not found" });
  }
  const created = await db.activity.create({
    data: {
      type: input.type,
      body: input.body,
      dueDate: input.dueDate,
      authorId: actorId,
      [activityParentField(input.entityType)]: input.entityId,
    },
  });
  await logAudit(db, {
    actorId,
    entityType: "ACTIVITY",
    entityId: created.id,
    action: "CREATE",
    diff: { type: created.type, entityType: input.entityType, entityId: input.entityId },
  });
  return created;
}
