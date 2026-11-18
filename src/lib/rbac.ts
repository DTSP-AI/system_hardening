import { TRPCError } from "@trpc/server";
import type { ScopedTx } from "@/lib/db";
import type { MembershipRoleName } from "@/lib/roles";
import { ensureMembership } from "@/lib/tenant";

export async function requireRole(
  db: ScopedTx,
  params: { tenantId: string; clerkOrgId: string; clerkUserId: string },
  allowed: MembershipRoleName[],
) {
  let membership = await db.membership.findFirst({ where: { clerkUserId: params.clerkUserId } });
  if (!membership) {
    // Self-heal: a membership predating the webhook, or one that raced it,
    // must not silently lock the user out of role-gated actions.
    membership = await ensureMembership(params);
  }
  if (!allowed.includes(membership.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You don't have permission to do this.",
    });
  }
  return membership;
}
