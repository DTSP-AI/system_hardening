import { cache } from "react";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { Prisma } from "@generated/prisma/client";
import type { User } from "@generated/prisma/client";
import { prisma } from "@/lib/db";

export type AppUserResult =
  | { status: "ok"; user: User }
  | { status: "unauthenticated" | "unverified_email" | "denied" | "unavailable" };

function fromRow(user: User): AppUserResult {
  return user.deactivatedAt ? { status: "denied" } : { status: "ok", user };
}

/**
 * Resolves the allowlisted app User for a Clerk user id. Uses the bare prisma
 * client (never the request transaction). First sign-in links the Clerk id to
 * the pre-created User row whose email matches the verified primary email.
 */
export async function resolveAppUser(clerkUserId: string): Promise<AppUserResult> {
  try {
    const linked = await prisma.user.findUnique({ where: { clerkUserId } });
    if (linked) return fromRow(linked);
  } catch {
    return { status: "unavailable" };
  }

  let email: string;
  try {
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(clerkUserId);
    const primary = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    );
    if (!primary || primary.verification?.status !== "verified") {
      return { status: "unverified_email" };
    }
    email = primary.emailAddress.trim().toLowerCase();
  } catch {
    return { status: "unavailable" };
  }

  try {
    let claimed = 0;
    try {
      const res = await prisma.user.updateMany({
        where: { email, clerkUserId: null, deactivatedAt: null },
        data: { clerkUserId },
      });
      claimed = res.count;
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
        throw err;
      }
    }

    if (claimed === 1) {
      const row = await prisma.user.findUnique({ where: { clerkUserId } });
      return row ? fromRow(row) : { status: "denied" };
    }

    const winner = await prisma.user.findUnique({ where: { clerkUserId } });
    if (winner) return fromRow(winner);

    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (!byEmail || byEmail.deactivatedAt) return { status: "denied" };
    if (byEmail.clerkUserId && byEmail.clerkUserId !== clerkUserId) {
      console.warn(
        `app-user: allowlist row ${byEmail.id} is linked to Clerk user ${byEmail.clerkUserId}; sign-in attempted by ${clerkUserId}`,
      );
    }
    return { status: "denied" };
  } catch {
    return { status: "unavailable" };
  }
}

/** Per-request cached resolution of the current Clerk session to an app User. */
export const getAppUser = cache(async (): Promise<AppUserResult> => {
  const { userId } = await auth();
  if (!userId) return { status: "unauthenticated" };
  return resolveAppUser(userId);
});

/** Route-handler guard: returns the app User or a ready-to-return error Response. */
export async function requireAppUserForRoute(): Promise<{ user: User } | Response> {
  const r = await getAppUser();
  switch (r.status) {
    case "ok":
      return { user: r.user };
    case "unauthenticated":
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    case "unverified_email":
    case "denied":
      return Response.json({ error: "Forbidden" }, { status: 403 });
    case "unavailable":
      return Response.json({ error: "Account verification unavailable" }, { status: 503 });
  }
}
