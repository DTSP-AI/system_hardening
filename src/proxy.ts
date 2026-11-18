import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  // Twilio's own server-to-server callbacks -- no Clerk session present,
  // authenticated instead via X-Twilio-Signature (readValidatedTwilioForm).
  "/api/twilio/voice(.*)",
  // Coaching relay -> CRM persistence callback -- no Clerk session, authenticated
  // instead via X-Coaching-Relay-Secret (see src/app/api/internal/coaching/route.ts).
  "/api/internal/coaching(.*)",
]);

const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  const { orgId } = await auth.protect();

  // tRPC/API requests surface "no active org" as a normal tRPC error instead
  // of a redirect -- redirecting a fetch() call would just hand the client
  // an HTML page instead of JSON.
  if (req.nextUrl.pathname.startsWith("/api")) return;

  if (!orgId && !isOnboardingRoute(req)) {
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }
  if (orgId && isOnboardingRoute(req)) {
    return NextResponse.redirect(new URL("/", req.url));
  }
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
