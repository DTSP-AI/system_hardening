import type { PrismaClient } from "@generated/prisma/client";
import type { DbTx } from "@/lib/db";

export type AttachmentEntityType = "CONTACT" | "COMPANY" | "DEAL" | "LEAD" | "ACCOUNT";

/** True if the polymorphic parent row exists. Throws on DB error (callers map it). */
export async function entityExists(
  db: PrismaClient | DbTx,
  type: AttachmentEntityType,
  id: string,
): Promise<boolean> {
  const args = { where: { id }, select: { id: true } } as const;
  switch (type) {
    case "CONTACT":
      return (await db.contact.findUnique(args)) !== null;
    case "COMPANY":
      return (await db.company.findUnique(args)) !== null;
    case "DEAL":
      return (await db.deal.findUnique(args)) !== null;
    case "LEAD":
      return (await db.lead.findUnique(args)) !== null;
    case "ACCOUNT":
      return (await db.account.findUnique(args)) !== null;
  }
}
