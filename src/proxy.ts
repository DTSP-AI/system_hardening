import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  // Twilio's own server-to-server callbacks -- no Clerk session present,
  // authenticated instead via X-Twilio-Signature (readValidatedTwilioForm).
  "/api/twilio/voice",
  "/api/twilio/voice/status",
  "/api/twilio/voice/recording",
  "/api/twilio/voice/announce",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;
  await auth.protect();
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
