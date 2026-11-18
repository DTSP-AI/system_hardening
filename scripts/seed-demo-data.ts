import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
neonConfig.webSocketConstructor = ws;

import { PrismaClient } from "../generated/prisma/client";

const TENANT_ID = "cmriips4k000004l5r29x1lu2"; // YBRYX COMMAND

const FIRST_NAMES = [
  "Ava", "Liam", "Maya", "Noah", "Zoe", "Ethan", "Priya", "Mason", "Layla", "Owen",
  "Nora", "Kai", "Ruby", "Elias", "Sadie", "Theo", "June", "Marcus", "Ines", "Dexter",
];
const LAST_NAMES = [
  "Reyes", "Chen", "Okafor", "Whitfield", "Novak", "Larsson", "Patel", "Bianchi",
  "Nakamura", "Delgado", "Sorensen", "Kowalski", "Mercer", "Alavi", "Fontaine",
  "Bramwell", "Osei", "Vance", "Iversen", "Castellano",
];
const COMPANY_WORDS = [
  "Brightline", "Northgate", "Vertex", "Cobalt", "Summit", "Redwood", "Anchor",
  "Lumen", "Fieldstone", "Harbor", "Ironclad", "Meridian", "Outrigger", "Pinecrest",
  "Rivergate", "Sable", "Timberline", "Wavefront", "Cascade", "Granite",
];
const COMPANY_SUFFIXES = ["Group", "Partners", "Solutions", "Industries", "Holdings", "& Co", "Systems", "Logistics"];
const INDUSTRIES = ["Manufacturing", "Logistics", "Construction", "Healthcare", "Retail", "Agriculture", "Energy", "Technology"];
const JOB_TITLES = ["Operations Manager", "VP of Sales", "Fleet Director", "Owner", "Procurement Lead", "CFO", "General Manager", "Purchasing Agent"];
const LEAD_SOURCES = ["Referral", "Cold Call", "Trade Show", "Website", "Partner", "Inbound Email"];
const DEAL_NOUNS = ["Equipment Refresh", "Fleet Expansion", "Financing Package", "Trade-In Deal", "New Location Buildout", "Seasonal Upgrade"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomPastOrFutureDate(daysSpread: number) {
  const offset = randInt(-daysSpread, daysSpread);
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
}

async function main() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const stages = await prisma.pipelineStage.findMany({ where: { tenantId: TENANT_ID } });
  if (stages.length === 0) throw new Error("No pipeline stages found for tenant");

  console.log("Seeding 20 companies...");
  const companies = [];
  for (let i = 0; i < 20; i++) {
    const name = `${pick(COMPANY_WORDS)} ${pick(COMPANY_SUFFIXES)}`;
    const company = await prisma.company.create({
      data: {
        tenantId: TENANT_ID,
        name,
        domain: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "")}.com`,
        industry: pick(INDUSTRIES),
        city: pick(["Austin", "Denver", "Charlotte", "Tampa", "Columbus", "Portland", "Nashville", "Boise"]),
        state: pick(["TX", "CO", "NC", "FL", "OH", "OR", "TN", "ID"]),
        country: "USA",
      },
    });
    companies.push(company);
  }

  console.log("Seeding 20 contacts...");
  const contacts = [];
  for (let i = 0; i < 20; i++) {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const company = pick(companies);
    const contact = await prisma.contact.create({
      data: {
        tenantId: TENANT_ID,
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${company.domain}`,
        phone: `(${randInt(200, 999)}) ${randInt(200, 999)}-${randInt(1000, 9999)}`,
        jobTitle: pick(JOB_TITLES),
        companyId: company.id,
        leadSource: pick(LEAD_SOURCES),
      },
    });
    contacts.push(contact);
  }

  console.log("Seeding 20 deals...");
  for (let i = 0; i < 20; i++) {
    const contact = pick(contacts);
    const stage = pick(stages);
    const won = stage.isWon;
    const lost = stage.isLost;
    await prisma.deal.create({
      data: {
        tenantId: TENANT_ID,
        name: `${contact.firstName ? contact.lastName : "Deal"} - ${pick(DEAL_NOUNS)}`,
        contactId: contact.id,
        companyId: contact.companyId,
        stageId: stage.id,
        amount: randInt(8, 420) * 1000,
        expectedCloseDate: randomPastOrFutureDate(45),
        closedAt: won || lost ? randomPastOrFutureDate(20) : null,
        status: won ? "WON" : lost ? "LOST" : "OPEN",
      },
    });
  }

  console.log("Done.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
