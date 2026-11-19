import { TRPCError } from "@trpc/server";
import type { Contact, Deal, Lead, LeadStatus } from "@generated/prisma/client";
import type { DbTx } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { stageFields } from "@/server/services/deal-stage";

/**
 * The one owner of a lead's status and its conversion. A lead is converted
 * when it has a convertedDealId; from then on its status never changes and a
 * repeat conversion returns the records made the first time.
 */

async function existingConversion(db: DbTx, lead: Lead): Promise<{ contact: Contact; deal: Deal } | null> {
  if (!lead.convertedContactId || !lead.convertedDealId) return null;
  const [contact, deal] = await Promise.all([
    db.contact.findUnique({ where: { id: lead.convertedContactId } }),
    db.deal.findUnique({ where: { id: lead.convertedDealId } }),
  ]);
  return contact && deal ? { contact, deal } : null;
}

/**
 * Converts a lead into a contact (and company) and an open deal. Idempotent:
 * the lead row is claimed with a conditional update, so of two concurrent
 * calls one does the work and the other waits on the row lock, then returns
 * the first call's records. Must run inside the caller's transaction.
 */
export async function convertLead(
  db: DbTx,
  params: { actorId: string; leadId: string },
): Promise<{ contact: Contact; deal: Deal }> {
  const claimed = await db.lead.updateMany({
    where: { id: params.leadId, convertedDealId: null },
    data: { status: "CONVERTED" },
  });

  const lead = await db.lead.findUnique({ where: { id: params.leadId } });
  if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });

  if (claimed.count === 0) {
    const existing = await existingConversion(db, lead);
    if (existing) return existing;
    throw new TRPCError({
      code: "CONFLICT",
      message: "This lead was already converted, but its contact or deal no longer exists",
    });
  }

  const firstStage = await db.pipelineStage.findFirst({
    where: { isWon: false, isLost: false },
    orderBy: { sortOrder: "asc" },
  });
  if (!firstStage) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No open pipeline stage exists to create the deal in",
    });
  }

  let companyId: string | undefined;
  if (lead.companyName) {
    const existing = await db.company.findFirst({ where: { name: lead.companyName } });
    companyId = existing ? existing.id : (await db.company.create({ data: { name: lead.companyName } })).id;
  }

  const contact = await db.contact.create({
    data: {
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      jobTitle: lead.jobTitle,
      leadSource: lead.source,
      companyId,
    },
  });

  const deal = await db.deal.create({
    data: {
      name: lead.companyName ?? `${lead.firstName} ${lead.lastName}`,
      contactId: contact.id,
      companyId,
      source: lead.source,
      ownerId: lead.ownerId,
      ...stageFields(firstStage),
    },
  });

  await db.lead.update({
    where: { id: lead.id },
    data: { status: "CONVERTED", convertedContactId: contact.id, convertedDealId: deal.id },
  });

  await logAudit(db, {
    actorId: params.actorId,
    entityType: "LEAD",
    entityId: lead.id,
    action: "UPDATE",
    diff: { status: "CONVERTED", convertedContactId: contact.id, convertedDealId: deal.id },
  });

  if (lead.ownerId && lead.ownerId !== params.actorId) {
    await notify(db, {
      userId: lead.ownerId,
      type: "LEAD_CONVERTED",
      title: `${lead.firstName} ${lead.lastName} converted to a deal`,
      linkHref: `/deals/${deal.id}`,
    });
  }

  return { contact, deal };
}

/**
 * Changes the status of a lead that has not been converted. CONVERTED is
 * reached only through convertLead, and a converted lead never leaves it.
 */
export async function setLeadStatus(
  db: DbTx,
  params: { actorId: string; leadId: string; status: LeadStatus },
): Promise<Lead> {
  if (params.status === "CONVERTED") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Use Convert to turn this lead into a contact and deal",
    });
  }
  const changed = await db.lead.updateMany({
    where: { id: params.leadId, convertedDealId: null },
    data: { status: params.status },
  });
  const lead = await db.lead.findUnique({ where: { id: params.leadId } });
  if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
  if (changed.count === 0) {
    throw new TRPCError({ code: "CONFLICT", message: "This lead is already converted and its status is final" });
  }
  await logAudit(db, {
    actorId: params.actorId,
    entityType: "LEAD",
    entityId: lead.id,
    action: "UPDATE",
    diff: { status: params.status },
  });
  return lead;
}
