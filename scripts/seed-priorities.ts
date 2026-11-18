import dotenv from "dotenv";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient } from "../generated/prisma/client";

// Demo priorities for the OWNER's Priorities board. Todo has no tag column, so demo rows are
// identified by exact title match against POOL (--remove deletes only those titles for the owner).
// Usage: seed-priorities [--remove]

const QUADRANTS = ["URGENT_IMPORTANT", "SCHEDULE", "DELEGATE", "BACK_BURNER"] as const;
const POOL = [
  "Call back the Summit HVAC decision maker",
  "Send proposal to Bayside Plumbing",
  "Close out Q4 pipeline review",
  "Follow up on stale renewals",
  "Fix failed payment for Ironwood Roofing",
  "Prep demo for Keystone Electrical",
  "Update pricing sheet for 2027",
  "Schedule onboarding with Harborview Landscaping",
  "Review contract redlines from Cardinal Pest Control",
  "Book trade show booth",
  "Plan referral partner dinner",
  "Refresh lead source report",
  "Hand off new-lead intake to the SDR",
  "Delegate invoice cleanup to accounting",
  "Assign territory for Orlando leads",
  "Ask ops to confirm install schedule",
  "Outsource LinkedIn outreach copy",
  "Have support audit open tickets",
  "Redesign the proposal template",
  "Explore a partner integration",
  "Research competitor pricing",
  "Rework the website case studies",
  "Organize the shared drive",
  "Write the annual customer survey",
  "Clean up duplicate contacts",
  "Review vendor subscriptions",
  "Draft the 2027 sales plan",
  "Check in with Meridian Dental after trial",
  "Collect testimonials from top five customers",
  "Renew domain and SSL certificates",
  "Train team on the new pipeline stages",
  "Reconcile commissions for last month",
];

async function main() {
  dotenv.config({ path: ".env.local", quiet: true });
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  neonConfig.webSocketConstructor = ws;
  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
  try {
    const owner = await prisma.user.findFirst({ where: { role: "OWNER", deactivatedAt: null, clerkUserId: { not: null } } });
    if (!owner?.clerkUserId) {
      console.error("No linked OWNER (sign in once first).");
      process.exit(1);
    }
    const where = { authorId: owner.clerkUserId, title: { in: POOL } };
    if (process.argv.includes("--remove")) {
      const r = await prisma.todo.deleteMany({ where });
      console.log(`removed todos=${r.count}`);
      return;
    }
    if ((await prisma.todo.count({ where })) > 0) {
      console.error("Demo priorities already exist. Run with --remove first.");
      process.exit(1);
    }
    const now = Date.now();
    const data = POOL.map((title, i) => ({
      authorId: owner.clerkUserId!,
      title,
      quadrant: QUADRANTS[Math.floor(Math.random() * QUADRANTS.length)],
      completed: Math.random() < 0.15,
      createdAt: new Date(now - (POOL.length - i) * 60_000),
    }));
    await prisma.todo.createMany({ data });
    const counts = Object.fromEntries(QUADRANTS.map((q) => [q, data.filter((d) => d.quadrant === q).length]));
    console.log(`seeded todos=${data.length}`, counts);
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
