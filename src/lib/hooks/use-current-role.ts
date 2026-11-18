import { trpc } from "@/lib/trpc/client";
import { ROLE_RANK, type MembershipRoleName } from "@/lib/roles";

export function useCurrentRole() {
  const membership = trpc.membership.me.useQuery();
  const role: MembershipRoleName = membership.data?.role ?? "MEMBER";
  return {
    role,
    isLoading: membership.isLoading,
    isAdmin: ROLE_RANK[role] >= ROLE_RANK.ADMIN,
  };
}
