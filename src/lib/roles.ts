export const ROLE_RANK = { MEMBER: 0, ADMIN: 1, OWNER: 2 } as const;
export type MembershipRoleName = keyof typeof ROLE_RANK;
