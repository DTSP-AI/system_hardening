import type { NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { prisma } from "@/lib/db";
import { ensureTenant, roleToMembershipRole } from "@/lib/tenant";

export async function POST(req: NextRequest) {
  let event;
  try {
    event = await verifyWebhook(req);
  } catch {
    return new Response("Invalid webhook signature", { status: 400 });
  }

  switch (event.type) {
    case "organization.created": {
      const org = event.data;
      await ensureTenant({ clerkOrgId: org.id, name: org.name, slug: org.slug });
      // The org creator's Membership row arrives via the
      // organizationMembership.created event Clerk fires right after this one.
      break;
    }

    case "organization.updated": {
      const org = event.data;
      await prisma.tenant.updateMany({
        where: { clerkOrgId: org.id },
        data: { name: org.name, slug: org.slug },
      });
      break;
    }

    case "organizationMembership.created":
    case "organizationMembership.updated": {
      const membership = event.data;
      const tenant = await prisma.tenant.findUnique({
        where: { clerkOrgId: membership.organization.id },
      });
      if (tenant) {
        await prisma.membership.upsert({
          where: {
            tenantId_clerkUserId: {
              tenantId: tenant.id,
              clerkUserId: membership.public_user_data.user_id,
            },
          },
          create: {
            tenantId: tenant.id,
            clerkUserId: membership.public_user_data.user_id,
            role: roleToMembershipRole(membership.role),
          },
          update: { role: roleToMembershipRole(membership.role) },
        });
      }
      break;
    }

    case "organizationMembership.deleted": {
      const membership = event.data;
      const tenant = await prisma.tenant.findUnique({
        where: { clerkOrgId: membership.organization.id },
      });
      if (tenant) {
        await prisma.membership.deleteMany({
          where: {
            tenantId: tenant.id,
            clerkUserId: membership.public_user_data.user_id,
          },
        });
      }
      break;
    }
  }

  return new Response("OK", { status: 200 });
}
