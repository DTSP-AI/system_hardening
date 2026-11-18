import dotenv from "dotenv";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient } from "../generated/prisma/client";

// Demo data for dashboard graphs. Every row is tagged so --remove can delete exactly it:
//   Company/Contact/Deal: customFields.demo = true
//   Lead: email ends with @demo.invalid
//   Activity: authorId = "demo-seed" (also cascades with demo contacts/deals)
// Usage: seed-demo            (refuses if demo rows already exist)
//        seed-demo --remove   (deletes all demo rows)

const DEMO_AUTHOR = "demo-seed";
const DEMO_EMAIL_DOMAIN = "demo.invalid";
const DAY = 24 * 60 * 60 * 1000;
const demoFlag = { demo: true };

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261118);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));

const FIRST = ["Avery", "Jordan", "Riley", "Morgan", "Casey", "Taylor", "Quinn", "Drew", "Parker", "Reese", "Skyler", "Cameron", "Harper", "Rowan", "Elliot", "Sage", "Dakota", "Emerson", "Finley", "Logan"];
const LAST = ["Nguyen", "Patel", "Brooks", "Hayes", "Ramirez", "Coleman", "Foster", "Bennett", "Sullivan", "Ortiz", "Whitaker", "Delgado", "Mercer", "Holland", "Navarro", "Pruitt", "Tran", "Gallagher", "Okafor", "Lindqvist"];
const TITLES = ["Owner", "General Manager", "Operations Director", "VP Sales", "Office Manager", "CFO", "Marketing Director"];
const INDUSTRIES = ["HVAC", "Plumbing", "Roofing", "Electrical", "Landscaping", "Pest Control", "Dental", "Real Estate", "Construction"];
const COMPANY_STEMS = ["Summit", "Bayside", "Ironwood", "Keystone", "Harborview", "Pinecrest", "Redline", "Bluebird", "Cardinal", "Granite", "Lakeshore", "Meridian", "Northgate", "Oakridge", "Prairie", "Silverline", "Trailhead", "Upland", "Vanguard", "Westbrook"];
const CITIES: ReadonlyArray<readonly [string, string, string]> = [["Tampa", "FL", "33602"], ["Orlando", "FL", "32801"], ["Atlanta", "GA", "30303"], ["Charlotte", "NC", "28202"], ["Nashville", "TN", "37203"], ["Austin", "TX", "78701"], ["Phoenix", "AZ", "85004"]];
const SOURCES = ["Website", "Referral", "Cold outreach", "Trade show", "Inbound call", "Partner"];
const NEXT_STEPS = ["Send proposal", "Schedule demo", "Follow up on pricing", "Intro call with decision maker", "Contract review", "Check in after trial"];

async function main() {
  const remove = process.argv.includes("--remove");
  dotenv.config({ path: ".env.local", quiet: true });
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  neonConfig.webSocketConstructor = ws;
  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

  try {
    const demoWhere = { customFields: { path: ["demo"], equals: true } };
    const leadWhere = { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } };

    if (remove) {
      const a = await prisma.activity.deleteMany({ where: { authorId: DEMO_AUTHOR } });
      const d = await prisma.deal.deleteMany({ where: demoWhere });
      const c = await prisma.contact.deleteMany({ where: demoWhere });
      const co = await prisma.company.deleteMany({ where: demoWhere });
      const l = await prisma.lead.deleteMany({ where: leadWhere });
      console.log(`removed activities=${a.count} deals=${d.count} contacts=${c.count} companies=${co.count} leads=${l.count}`);
      return;
    }

    const existing = (await prisma.company.count({ where: demoWhere })) + (await prisma.lead.count({ where: leadWhere }));
    if (existing > 0) {
      console.error("Demo rows already exist. Run with --remove first.");
      process.exit(1);
    }

    const stages = await prisma.pipelineStage.findMany({ orderBy: { sortOrder: "asc" } });
    const open = stages.filter((s) => !s.isWon && !s.isLost);
    const won = stages.find((s) => s.isWon);
    const lost = stages.find((s) => s.isLost);
    if (open.length === 0 || !won || !lost) {
      console.error("Pipeline stages missing (need open, won, lost).");
      process.exit(1);
    }

    const now = Date.now();

    // Companies
    const companies = [];
    for (let i = 0; i < 20; i++) {
      const [city, state, postalCode] = pick(CITIES);
      const name = `${COMPANY_STEMS[i]} ${pick(INDUSTRIES)} Co.`;
      companies.push(
        await prisma.company.create({
          data: {
            name,
            domain: `${COMPANY_STEMS[i].toLowerCase()}-demo.${DEMO_EMAIL_DOMAIN}`,
            industry: pick(INDUSTRIES),
            city,
            state,
            postalCode,
            country: "US",
            customFields: demoFlag,
            createdAt: new Date(now - between(10, 70) * DAY),
          },
        }),
      );
    }

    // Contacts (1-3 per company, ~35)
    const contacts = [];
    for (let i = 0; i < 35; i++) {
      const company = companies[i % companies.length];
      const first = pick(FIRST);
      const last = pick(LAST);
      contacts.push(
        await prisma.contact.create({
          data: {
            firstName: first,
            lastName: last,
            email: `${first}.${last}.${i}@${DEMO_EMAIL_DOMAIN}`.toLowerCase(),
            phone: `+1813555${String(1000 + i).padStart(4, "0")}`,
            jobTitle: pick(TITLES),
            companyId: company.id,
            leadSource: pick(SOURCES),
            type: "CUSTOMER",
            customFields: demoFlag,
            createdAt: new Date(now - between(5, 65) * DAY),
          },
        }),
      );
    }

    // Leads (30, mixed statuses)
    const leadStatuses = ["NEW", "NEW", "NEW", "CONTACTED", "CONTACTED", "QUALIFIED", "UNQUALIFIED"] as const;
    for (let i = 0; i < 30; i++) {
      const first = pick(FIRST);
      const last = pick(LAST);
      await prisma.lead.create({
        data: {
          firstName: first,
          lastName: last,
          email: `${first}.${last}.lead${i}@${DEMO_EMAIL_DOMAIN}`.toLowerCase(),
          phone: `+1727555${String(2000 + i).padStart(4, "0")}`,
          companyName: `${pick(COMPANY_STEMS)} ${pick(INDUSTRIES)}`,
          jobTitle: pick(TITLES),
          source: pick(SOURCES),
          status: pick(leadStatuses),
          createdAt: new Date(now - between(0, 56) * DAY),
        },
      });
    }

    // Deals (45) spread over 8 weeks, ramping up toward recent weeks
    const deals = [];
    for (let i = 0; i < 45; i++) {
      const ageDays = Math.floor(Math.pow(rand(), 1.4) * 55); // skew recent
      const createdAt = new Date(now - ageDays * DAY - between(0, 12) * 3600_000);
      const roll = rand();
      const status = roll < 0.2 ? "WON" : roll < 0.32 ? "LOST" : "OPEN";
      const stage = status === "WON" ? won : status === "LOST" ? lost : pick(open);
      const contact = pick(contacts);
      const stale = status === "OPEN" && ageDays > 16 && rand() < 0.5;
      const updatedAt = stale
        ? new Date(now - between(15, Math.max(16, ageDays)) * DAY)
        : new Date(now - between(0, Math.min(ageDays, 10)) * DAY);
      deals.push(
        await prisma.deal.create({
          data: {
            name: `${contact.companyId ? companies.find((c) => c.id === contact.companyId)!.name : "Demo"} — ${pick(["Service Plan", "Renewal", "New Install", "Expansion", "Annual Contract"])}`,
            contactId: contact.id,
            companyId: contact.companyId,
            stageId: stage.id,
            amount: between(15, 480) * 100,
            status,
            priority: pick(["LOW", "MEDIUM", "MEDIUM", "HIGH"] as const),
            source: pick(SOURCES),
            nextStep: status === "OPEN" ? pick(NEXT_STEPS) : null,
            expectedCloseDate: new Date(now + between(-5, 45) * DAY),
            closedAt: status === "OPEN" ? null : new Date(now - between(0, Math.max(1, ageDays)) * DAY),
            customFields: demoFlag,
            createdAt,
            updatedAt,
          },
        }),
      );
    }

    // Activities: historical mix tied to deals/contacts
    const types = ["NOTE", "CALL", "EMAIL", "MEETING", "TEXT", "TASK"] as const;
    let activityCount = 0;
    for (const deal of deals) {
      const n = between(1, 4);
      for (let k = 0; k < n; k++) {
        const type = pick(types);
        const createdAt = new Date(
          Math.min(now - 3600_000, deal.createdAt.getTime() + between(0, 20) * DAY),
        );
        await prisma.activity.create({
          data: {
            type,
            contactId: deal.contactId,
            dealId: deal.id,
            authorId: DEMO_AUTHOR,
            body: `Demo ${type.toLowerCase()} for ${deal.name}`,
            metadata: type === "CALL" ? { demo: true, status: pick(["completed", "no-answer", "busy"]) } : { demo: true },
            createdAt,
          },
        });
        activityCount++;
      }
    }

    // Today's calls (feeds the dashboard calls tiles)
    for (let i = 0; i < 14; i++) {
      const contact = pick(contacts);
      await prisma.activity.create({
        data: {
          type: "CALL",
          contactId: contact.id,
          authorId: DEMO_AUTHOR,
          body: "Demo outbound call",
          metadata: { demo: true, status: pick(["completed", "completed", "in-progress", "no-answer", "busy"]) },
          createdAt: new Date(now - (i + 1) * 4 * 60_000),
        },
      });
      activityCount++;
    }

    console.log(`seeded companies=${companies.length} contacts=${contacts.length} leads=30 deals=${deals.length} activities=${activityCount}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
