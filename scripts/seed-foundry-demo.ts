import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
neonConfig.webSocketConstructor = ws;

import { PrismaClient } from "../generated/prisma/client";

const TENANT_ID = "cmrjwkmc9000004k0wes2c9cx"; // Foundry Protects

const CARRIERS = [
  { name: "Progressive", naicCode: "24260", phone: "(800) 776-4737", website: "progressiveagent.com" },
  { name: "Travelers", naicCode: "25658", phone: "(800) 252-4633", website: "travelers.com" },
  { name: "Safeco", naicCode: "24740", phone: "(800) 332-3226", website: "safeco.com" },
  { name: "Liberty Mutual", naicCode: "23043", phone: "(800) 290-8711", website: "libertymutual.com" },
  { name: "The Hartford", naicCode: "19682", phone: "(860) 547-5000", website: "thehartford.com" },
  { name: "Nationwide", naicCode: "23787", phone: "(877) 669-6877", website: "nationwide.com" },
  { name: "Chubb", naicCode: "20699", phone: "(800) 252-4670", website: "chubb.com" },
  { name: "Erie Insurance", naicCode: "26271", phone: "(800) 458-0811", website: "erieinsurance.com" },
];

const FIRST_NAMES = [
  "Grace", "Miles", "Isla", "Wyatt", "Nadia", "Beckett", "Freya", "Julian", "Rosa", "Hendrix",
  "Willa", "August", "Sana", "Cole", "Vera", "Emmett", "Talia", "Rhys", "Mira", "Sawyer",
];
const LAST_NAMES = [
  "Whitcomb", "Farris", "Dunmore", "Salcedo", "Herrick", "Ambrose", "Pruitt", "Villareal",
  "Cross", "Beaumont", "Ferreira", "Lockhart", "Stavros", "Whittier", "Kessler", "Onyango",
  "Barreto", "Sundberg", "Traynor", "Ferris",
];
const CITIES = [
  ["Scottsdale", "AZ"], ["Naperville", "IL"], ["Frisco", "TX"], ["Cary", "NC"], ["Boise", "ID"],
  ["Reno", "NV"], ["Overland Park", "KS"], ["Franklin", "TN"], ["Bend", "OR"], ["Fishers", "IN"],
] as const;

const COMPANY_NAMES = [
  "Ridgeline Contracting", "Blue Anchor Restaurant Group", "Prairie Fresh Grocers",
  "Copperfield Manufacturing", "Sunridge Property Management", "Vantage Auto Body",
  "Harborview Logistics", "Timberwolf Landscaping",
];
const COMPANY_INDUSTRIES = ["Construction", "Restaurant", "Retail", "Manufacturing", "Real Estate", "Automotive", "Logistics", "Landscaping"];

const PERSONAL_LOBS = ["PERSONAL_AUTO", "HOMEOWNERS", "RENTERS", "PERSONAL_UMBRELLA", "MOTORCYCLE", "BOAT"] as const;
const COMMERCIAL_LOBS = ["BOP", "COMMERCIAL_AUTO", "GENERAL_LIABILITY", "WORKERS_COMP", "COMMERCIAL_PROPERTY", "COMMERCIAL_UMBRELLA"] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function addYears(date: Date, years: number) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}
function policyNumber(prefix: string) {
  return `${prefix}-${randInt(100000, 999999)}`;
}

async function main() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: TENANT_ID } });
  console.log(`Seeding demo data for ${tenant.name}...`);

  console.log("Seeding carriers...");
  const carriers = [];
  for (const c of CARRIERS) {
    carriers.push(
      await prisma.carrier.create({
        data: { tenantId: TENANT_ID, ...c, portalUrl: `https://agents.${c.website}` },
      }),
    );
  }

  console.log("Seeding personal-lines contacts...");
  const contacts = [];
  for (let i = 0; i < 16; i++) {
    const firstName = FIRST_NAMES[i];
    const lastName = pick(LAST_NAMES);
    contacts.push(
      await prisma.contact.create({
        data: {
          tenantId: TENANT_ID,
          firstName,
          lastName,
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@gmail.com`,
          phone: `(${randInt(200, 999)}) ${randInt(200, 999)}-${randInt(1000, 9999)}`,
          type: "CUSTOMER",
          leadSource: pick(["Referral", "Google", "Facebook Ads", "Walk-in", "Cross-sell"]),
        },
      }),
    );
  }

  console.log("Seeding commercial companies...");
  const companies = [];
  for (let i = 0; i < COMPANY_NAMES.length; i++) {
    const [city, state] = pick(CITIES);
    companies.push(
      await prisma.company.create({
        data: {
          tenantId: TENANT_ID,
          name: COMPANY_NAMES[i],
          industry: COMPANY_INDUSTRIES[i],
          city,
          state,
          country: "USA",
        },
      }),
    );
  }

  const now = new Date();
  // Days-until-expiration buckets: some due soon (renewals demo), most further out.
  const expirationOffsets = [
    12, 19, 27, // due in 30 days
    38, 45, 52, // 31-60 days
    68, 75, 84, // 61-90 days
    130, 160, 210, 250, 300, 340, // further out, active
  ];

  console.log("Seeding personal policies...");
  const policies = [];
  for (const contact of contacts) {
    const numPolicies = randInt(1, 2);
    for (let i = 0; i < numPolicies; i++) {
      const lob = pick(PERSONAL_LOBS);
      const carrier = pick(carriers);
      const offset = pick(expirationOffsets);
      const expirationDate = addDays(now, offset);
      const effectiveDate = addYears(expirationDate, -1);
      const premium = lob === "HOMEOWNERS" ? randInt(1400, 3800) : lob === "PERSONAL_UMBRELLA" ? randInt(300, 700) : randInt(900, 2600);
      const policy = await prisma.policy.create({
        data: {
          tenantId: TENANT_ID,
          policyNumber: policyNumber("PL"),
          lineOfBusiness: lob,
          status: "ACTIVE",
          billingType: pick(["DIRECT_BILL", "AGENCY_BILL"]),
          premium,
          effectiveDate,
          expirationDate,
          carrierId: carrier.id,
          contactId: contact.id,
          ownerId: null,
        },
      });
      policies.push(policy);
    }
  }

  console.log("Seeding commercial policies...");
  for (const company of companies) {
    const lob = pick(COMMERCIAL_LOBS);
    const carrier = pick(carriers);
    const offset = pick(expirationOffsets);
    const expirationDate = addDays(now, offset);
    const effectiveDate = addYears(expirationDate, -1);
    const premium = lob === "WORKERS_COMP" ? randInt(8000, 22000) : lob === "COMMERCIAL_PROPERTY" ? randInt(4000, 15000) : randInt(2500, 12000);
    const policy = await prisma.policy.create({
      data: {
        tenantId: TENANT_ID,
        policyNumber: policyNumber("CL"),
        lineOfBusiness: lob,
        status: "ACTIVE",
        billingType: "AGENCY_BILL",
        premium,
        effectiveDate,
        expirationDate,
        carrierId: carrier.id,
        companyId: company.id,
        ownerId: null,
      },
    });
    policies.push(policy);
  }

  console.log("Seeding a couple of quotes and a cancelled policy...");
  for (let i = 0; i < 3; i++) {
    const contact = pick(contacts);
    const carrier = pick(carriers);
    const effectiveDate = addDays(now, randInt(5, 20));
    await prisma.policy.create({
      data: {
        tenantId: TENANT_ID,
        policyNumber: policyNumber("QT"),
        lineOfBusiness: pick(PERSONAL_LOBS),
        status: "QUOTE",
        billingType: "DIRECT_BILL",
        premium: randInt(800, 2400),
        effectiveDate,
        expirationDate: addYears(effectiveDate, 1),
        carrierId: carrier.id,
        contactId: contact.id,
      },
    });
  }
  {
    const contact = pick(contacts);
    const carrier = pick(carriers);
    const expirationDate = addDays(now, -20);
    await prisma.policy.create({
      data: {
        tenantId: TENANT_ID,
        policyNumber: policyNumber("PL"),
        lineOfBusiness: "PERSONAL_AUTO",
        status: "CANCELLED",
        billingType: "DIRECT_BILL",
        premium: randInt(900, 1800),
        effectiveDate: addYears(expirationDate, -1),
        expirationDate,
        carrierId: carrier.id,
        contactId: contact.id,
      },
    });
  }

  console.log("Seeding commissions...");
  for (const policy of policies) {
    const rate = randInt(10, 15);
    const amount = (Number(policy.premium) * rate) / 100;
    await prisma.commission.create({
      data: {
        tenantId: TENANT_ID,
        policyId: policy.id,
        type: "NEW_BUSINESS",
        amount,
        rate,
        statementDate: addDays(policy.effectiveDate, randInt(5, 25)),
        paid: Math.random() > 0.3,
      },
    });
  }

  console.log("Seeding claims...");
  const claimPolicies = [...policies].sort(() => Math.random() - 0.5).slice(0, 5);
  const claimStatuses = ["OPEN", "CLOSED", "OPEN", "DENIED", "REOPENED"] as const;
  for (let i = 0; i < claimPolicies.length; i++) {
    const policy = claimPolicies[i];
    const status = claimStatuses[i];
    const dateOfLoss = addDays(now, -randInt(10, 120));
    await prisma.claim.create({
      data: {
        tenantId: TENANT_ID,
        policyId: policy.id,
        claimNumber: `CLM-${randInt(10000, 99999)}`,
        dateOfLoss,
        description: pick([
          "Rear-end collision, minor damage",
          "Wind damage to roof shingles",
          "Water damage from burst pipe",
          "Theft of equipment from job site",
          "Slip and fall on premises",
        ]),
        status,
        reserveAmount: randInt(1500, 25000),
        paidAmount: status === "CLOSED" ? randInt(1000, 20000) : undefined,
        adjusterName: pick(["Dana Ruiz", "Tom Whitfield", "Priya Anand", "Marcus Doyle"]),
        adjusterPhone: `(${randInt(200, 999)}) ${randInt(200, 999)}-${randInt(1000, 9999)}`,
        closedAt: status === "CLOSED" || status === "DENIED" ? addDays(dateOfLoss, randInt(10, 60)) : null,
      },
    });
  }

  console.log(`Done. ${carriers.length} carriers, ${contacts.length} contacts, ${companies.length} companies, ${policies.length + 4} policies.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
