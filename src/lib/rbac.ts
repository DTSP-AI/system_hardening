import { TRPCError } from "@trpc/server";
import type { DbTx } from "@/lib/db";
import type { MembershipRoleName } from "@/lib/roles";

export async function requireRole(db: DbTx, clerkUserId: string, allowed: MembershipRoleName[]) {
  const user = await db.user.findUnique({ where: { clerkUserId } });
  if (!user || !allowed.includes(user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You don't have permission to do this.",
    });
  }
  return user;
}
