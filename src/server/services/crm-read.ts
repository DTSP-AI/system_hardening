import { TRPCError } from "@trpc/server";
import type { DbTx } from "@/lib/db";
import type { EntityType } from "@/lib/entity-types";

/**
 * Bounded reads for machine clients (the MCP tools). Every list returns at
 * most MAX_PAGE_SIZE rows and a cursor; nothing here loads a whole table.
 */

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export type PageArgs = { limit?: number; cursor?: string };
export type Page<T> = { items: T[]; nextCursor: string | null };

function pageQuery(args: PageArgs) {
  const limit = Math.min(Math.max(args.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  return {
    limit,
    query: {
      take: limit + 1,
      ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
      // id breaks ties so the order is total and a cursor never skips or repeats a row.
      orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
    },
  };
}

function toPage<T extends { id: string }>(rows: T[], limit: number): Page<T> {
  const items = rows.slice(0, limit);
  return { items, nextCursor: rows.length > limit ? items[items.length - 1].id : null };
}

function notFound(what: string): never {
  throw new TRPCError({ code: "NOT_FOUND", message: `${what} not found` });
}

export async function listLeads(
  db: DbTx,
  args: PageArgs & { status?: "NEW" | "CONTACTED" | "QUALIFIED" | "UNQUALIFIED" | "CONVERTED" },
) {
  const { limit, query } = pageQuery(args);
  const rows = await db.lead.findMany({ ...query, where: args.status ? { status: args.status } : undefined });
  return toPage(rows, limit);
}

export async function getLead(db: DbTx, id: string) {
  return (await db.lead.findUnique({ where: { id } })) ?? notFound("Lead");
}

export async function listDeals(
  db: DbTx,
  args: PageArgs & { status?: "OPEN" | "WON" | "LOST"; stageId?: string },
) {
  const { limit, query } = pageQuery(args);
  const rows = await db.deal.findMany({
    ...query,
    where: { ...(args.status ? { status: args.status } : {}), ...(args.stageId ? { stageId: args.stageId } : {}) },
    include: { stage: { select: { id: true, name: true, isWon: true, isLost: true } } },
  });
  return toPage(rows, limit);
}

export async function getDeal(db: DbTx, id: string) {
  const deal = await db.deal.findUnique({
    where: { id },
    include: {
      stage: true,
      contact: { select: { id: true, firstName: true, lastName: true, email: true } },
      company: { select: { id: true, name: true } },
      account: { select: { id: true } },
    },
  });
  return deal ?? notFound("Deal");
}

export async function listContacts(db: DbTx, args: PageArgs & { companyId?: string }) {
  const { limit, query } = pageQuery(args);
  const rows = await db.contact.findMany({
    ...query,
    where: args.companyId ? { companyId: args.companyId } : undefined,
  });
  return toPage(rows, limit);
}

export async function getContact(db: DbTx, id: string) {
  const contact = await db.contact.findUnique({
    where: { id },
    include: { company: { select: { id: true, name: true } } },
  });
  return contact ?? notFound("Contact");
}

export async function listCompanies(db: DbTx, args: PageArgs) {
  const { limit, query } = pageQuery(args);
  return toPage(await db.company.findMany(query), limit);
}

export async function getCompany(db: DbTx, id: string) {
  return (await db.company.findUnique({ where: { id } })) ?? notFound("Company");
}

export async function listAccounts(db: DbTx, args: PageArgs & { status?: "ACTIVE" | "CHURNED" }) {
  const { limit, query } = pageQuery(args);
  const rows = await db.account.findMany({ ...query, where: args.status ? { status: args.status } : undefined });
  return toPage(rows, limit);
}

export async function getAccount(db: DbTx, id: string) {
  const account = await db.account.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true, email: true } },
      sourceDeal: { select: { id: true, name: true } },
    },
  });
  return account ?? notFound("Account");
}

export function listPipelineStages(db: DbTx) {
  return db.pipelineStage.findMany({ orderBy: { sortOrder: "asc" } });
}

const ACTIVITY_PARENT = {
  CONTACT: "contactId",
  DEAL: "dealId",
  LEAD: "leadId",
  ACCOUNT: "accountId",
} as const;

export type ActivityParentType = keyof typeof ACTIVITY_PARENT;
export const ACTIVITY_PARENT_TYPES = Object.keys(ACTIVITY_PARENT) as [ActivityParentType, ...ActivityParentType[]];

/** The Activity foreign-key column for a parent record type. Companies carry no activities. */
export function activityParentField(type: ActivityParentType) {
  return ACTIVITY_PARENT[type];
}

export async function listActivities(
  db: DbTx,
  args: PageArgs & { entityType: ActivityParentType; entityId: string },
) {
  const { limit, query } = pageQuery(args);
  const rows = await db.activity.findMany({
    ...query,
    where: { [activityParentField(args.entityType)]: args.entityId },
  });
  return toPage(rows, limit);
}

/** Up to five matches per record type, the same search the UI's global search runs. */
export async function searchRecords(db: DbTx, queryText: string) {
  const q = queryText;
  const [contacts, companies, deals, leads] = await Promise.all([
    db.contact.findMany({
      where: {
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
    db.company.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      take: 5,
      select: { id: true, name: true, domain: true },
    }),
    db.deal.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      take: 5,
      select: { id: true, name: true, amount: true },
    }),
    db.lead.findMany({
      where: {
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { companyName: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: { id: true, firstName: true, lastName: true, companyName: true },
    }),
  ]);
  return { contacts, companies, deals, leads };
}

export type { EntityType };
