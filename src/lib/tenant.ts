import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import type { MembershipRoleName } from "@/lib/roles";

export const DEFAULT_PIPELINE_STAGES = [
  { name: "New", sortOrder: 0, isWon: false, isLost: false },
  { name: "Qualifying", sortOrder: 1, isWon: false, isLost: false },
  { name: "Proposal", sortOrder: 2, isWon: false, isLost: false },
  { name: "Negotiation", sortOrder: 3, isWon: false, isLost: false },
  { name: "Won", sortOrder: 4, isWon: true, isLost: false },
  { name: "Lost", sortOrder: 5, isWon: false, isLost: true },
];

/**
 * Finds the local Tenant for a Clerk org, creating it (with default pipeline
 * stages) if it doesn't exist yet. This is normally done by the
 * `organization.created` webhook, but that's async and can race a user who
 * creates an org and immediately starts using the app -- so every path that
 * needs a Tenant (webhook AND the tenantProcedure fallback) goes through
 * this same idempotent function rather than assuming the webhook already ran.
 */
export async function ensureTenant(params: {
  clerkOrgId: string;
  name: string;
  slug: string | null;
}) {
  const existing = await prisma.tenant.findUnique({ where: { clerkOrgId: params.clerkOrgId } });
  if (existing) return existing;

  const slug = params.slug ?? `${params.clerkOrgId.replace(/^org_/, "")}`;

  try {
    const tenant = await prisma.tenant.create({
      data: { clerkOrgId: params.clerkOrgId, name: params.name, slug },
    });
    await prisma.pipelineStage.createMany({
      data: DEFAULT_PIPELINE_STAGES.map((stage) => ({ ...stage, tenantId: tenant.id })),
    });
    return tenant;
  } catch {
    // Unique constraint race: the webhook (or a concurrent request) created it first.
    const raced = await prisma.tenant.findUnique({ where: { clerkOrgId: params.clerkOrgId } });
    if (raced) return raced;
    throw new Error(`Failed to provision tenant for org ${params.clerkOrgId}`);
  }
}

// Clerk's default role set is just org:admin / org:member (no separate "owner"
// concept unless custom roles are configured later). Map admin -> OWNER so the
// workspace creator gets full local permissions; ADMIN is reserved for future
// custom Clerk roles. Shared with the organizationMembership.* webhook handler.
export function roleToMembershipRole(role: string): MembershipRoleName {
  if (role === "org:admin") return "OWNER";
  return "MEMBER";
}

/**
 * Finds the local Membership row for a user in a tenant, creating it (from
 * Clerk's own membership record) if it doesn't exist yet. Mirrors
 * `ensureTenant`'s self-healing role: the `organizationMembership.*` webhook
 * normally keeps this in sync, but a user whose membership predates the
 * webhook, or who raced it, must not be silently locked out of role-gated
 * actions -- fall back to asking Clerk directly.
 */
export async function ensureMembership(params: {
  tenantId: string;
  clerkOrgId: string;
  clerkUserId: string;
}) {
  const existing = await prisma.membership.findUnique({
    where: { tenantId_clerkUserId: { tenantId: params.tenantId, clerkUserId: params.clerkUserId } },
  });
  if (existing) return existing;

  const client = await clerkClient();
  const { data } = await client.organizations.getOrganizationMembershipList({
    organizationId: params.clerkOrgId,
    userId: [params.clerkUserId],
  });
  const role = roleToMembershipRole(data[0]?.role ?? "org:member");

  try {
    return await prisma.membership.create({
      data: { tenantId: params.tenantId, clerkUserId: params.clerkUserId, role },
    });
  } catch {
    const raced = await prisma.membership.findUnique({
      where: { tenantId_clerkUserId: { tenantId: params.tenantId, clerkUserId: params.clerkUserId } },
    });
    if (raced) return raced;
    throw new Error(
      `Failed to provision membership for user ${params.clerkUserId} in tenant ${params.tenantId}`,
    );
  }
}
