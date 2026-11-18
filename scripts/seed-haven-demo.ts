import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
neonConfig.webSocketConstructor = ws;

import { PrismaClient } from "../generated/prisma/client";

const TENANT_ID = "cmrl9gkrc000004l5iol9f1dd"; // Haven Home Solutions

const VENDORS = [
  { name: "Qcells", type: "PANEL_MANUFACTURER", phone: "(800) 838-8339", website: "qcells.com" },
  { name: "REC Group", type: "PANEL_MANUFACTURER", phone: "(877) 838-7269", website: "recgroup.com" },
  { name: "Silfab Solar", type: "PANEL_MANUFACTURER", phone: "(360) 314-2087", website: "silfabsolar.com" },
  { name: "Enphase Energy", type: "INVERTER_MANUFACTURER", phone: "(877) 797-4743", website: "enphase.com" },
  { name: "SolarEdge", type: "INVERTER_MANUFACTURER", phone: "(510) 498-3200", website: "solaredge.com" },
  { name: "Tesla Energy", type: "BATTERY_MANUFACTURER", phone: "(888) 765-2489", website: "tesla.com/energy" },
  { name: "IronRidge", type: "RACKING_MANUFACTURER", phone: "(925) 245-8100", website: "ironridge.com" },
  { name: "Soligent Distribution", type: "DISTRIBUTOR", phone: "(707) 823-8700", website: "soligent.net" },
] as const;

const FIRST_NAMES = [
  "Karen", "Dennis", "Priya", "Todd", "Marisol", "Gary", "Yolanda", "Brent", "Alicia", "Doug",
  "Renee", "Stan", "Bethany", "Craig", "Lupe", "Kevin", "Sherry", "Nate", "Dana", "Ollie",
];
const LAST_NAMES = [
  "Whitfield", "Marchetti", "Kowalski", "Boudreaux", "Nakamura", "Fitzgerald", "Okafor", "Simms",
  "Delgado", "Prentiss", "Halvorsen", "Bianchi", "Osei", "Guzman", "Thackeray", "Ives",
  "Castellano", "Njoroge", "Wren", "Tallman",
];
const CITIES = [
  ["Mesa", "AZ"], ["Fresno", "CA"], ["Albuquerque", "NM"], ["Tucson", "AZ"], ["Bakersfield", "CA"],
  ["Las Vegas", "NV"], ["El Paso", "TX"], ["Riverside", "CA"], ["Henderson", "NV"], ["Modesto", "CA"],
] as const;

const COMPANY_NAMES = [
  "Desert Bloom Apartments", "Sunview Self Storage", "Cactus Ridge HOA",
  "Valley Fresh Market", "Palmetto Auto Rentals",
];
const COMPANY_INDUSTRIES = ["Property Management", "Storage", "Real Estate", "Retail", "Automotive"];

const FINANCING_TYPES = ["CASH", "LOAN", "LEASE", "PPA"] as const;
const PROJECT_STATUSES = [
  "SOLD", "SITE_SURVEY", "DESIGN", "PERMITTING", "SCHEDULED",
  "INSTALLING", "INSTALLED", "INSPECTION", "UTILITY_PTO", "COMPLETE", "CANCELLED",
] as const;
const SERVICE_ISSUE_TYPES = [
  "PERFORMANCE", "EQUIPMENT_FAILURE", "ROOF_LEAK", "MONITORING", "BILLING", "WARRANTY", "OTHER",
] as const;
const SERVICE_TICKET_STATUSES = ["OPEN", "SCHEDULED", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

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
function projectNumber() {
  return `HHS-${randInt(10000, 99999)}`;
}

async function main() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: TENANT_ID } });
  console.log(`Seeding demo data for ${tenant.name}...`);

  console.log("Seeding vendors...");
  const vendors = [];
  for (const v of VENDORS) {
    vendors.push(
      await prisma.vendor.create({
        data: { tenantId: TENANT_ID, ...v, portalUrl: `https://portal.${v.website}` },
      }),
    );
  }
  const panelVendors = vendors.filter((v) => v.type === "PANEL_MANUFACTURER");
  const inverterVendors = vendors.filter((v) => v.type === "INVERTER_MANUFACTURER");

  console.log("Seeding residential contacts...");
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
          leadSource: pick(["Referral", "Google", "Home Show", "Door Knock", "Facebook Ads"]),
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

  console.log("Seeding residential projects...");
  const projects = [];
  for (const contact of contacts) {
    const [city, state] = pick(CITIES);
    const status = pick(PROJECT_STATUSES.filter((s) => s !== "CANCELLED"));
    const soldDate = addDays(now, -randInt(20, 300));
    const systemSizeKw = randInt(45, 140) / 10;
    const panelCount = randInt(14, 40);
    const contractAmount = randInt(18000, 55000);

    const isPastMilestone = (daysAfterSold: number) =>
      new Date(soldDate.getTime()) < addDays(now, 0) && randInt(0, 1) === 1
        ? addDays(soldDate, daysAfterSold)
        : undefined;

    const project = await prisma.project.create({
      data: {
        tenantId: TENANT_ID,
        projectNumber: projectNumber(),
        status,
        financingType: pick(FINANCING_TYPES),
        systemSizeKw,
        panelCount,
        contractAmount,
        panelVendorId: pick(panelVendors).id,
        inverterVendorId: pick(inverterVendors).id,
        installAddressLine1: `${randInt(100, 9999)} ${pick(["Saguaro", "Mesquite", "Canyon", "Sundial", "Ocotillo", "Vista"])} ${pick(["St", "Ave", "Dr", "Way"])}`,
        installCity: city,
        installState: state,
        installPostalCode: `${randInt(70000, 93000)}`,
        contactId: contact.id,
        soldDate,
        siteSurveyDate: isPastMilestone(7),
        permitSubmittedDate: isPastMilestone(21),
        permitApprovedDate: isPastMilestone(35),
        installStartDate: isPastMilestone(50),
        installCompleteDate: isPastMilestone(55),
        inspectionDate: isPastMilestone(65),
        ptoDate: status === "COMPLETE" ? addDays(soldDate, randInt(70, 90)) : undefined,
      },
    });
    projects.push(project);
  }

  console.log("Seeding commercial projects...");
  for (const company of companies) {
    const status = pick(PROJECT_STATUSES.filter((s) => s !== "CANCELLED"));
    const soldDate = addDays(now, -randInt(30, 250));
    const project = await prisma.project.create({
      data: {
        tenantId: TENANT_ID,
        projectNumber: projectNumber(),
        status,
        financingType: pick(["CASH", "LOAN", "PPA"] as const),
        systemSizeKw: randInt(300, 1200) / 10,
        panelCount: randInt(80, 320),
        contractAmount: randInt(120000, 480000),
        panelVendorId: pick(panelVendors).id,
        inverterVendorId: pick(inverterVendors).id,
        installCity: company.city ?? undefined,
        installState: company.state ?? undefined,
        companyId: company.id,
        soldDate,
        ptoDate: status === "COMPLETE" ? addDays(soldDate, randInt(90, 150)) : undefined,
      },
    });
    projects.push(project);
  }

  console.log("Seeding a couple cancelled projects...");
  for (let i = 0; i < 2; i++) {
    const contact = pick(contacts);
    await prisma.project.create({
      data: {
        tenantId: TENANT_ID,
        projectNumber: projectNumber(),
        status: "CANCELLED",
        financingType: pick(FINANCING_TYPES),
        systemSizeKw: randInt(45, 90) / 10,
        panelCount: randInt(14, 26),
        contractAmount: randInt(18000, 32000),
        contactId: contact.id,
        soldDate: addDays(now, -randInt(10, 60)),
      },
    });
  }

  console.log("Seeding project commissions...");
  for (const project of projects) {
    const rate = randInt(3, 6);
    const amount = (Number(project.contractAmount) * rate) / 100;
    await prisma.projectCommission.create({
      data: {
        tenantId: TENANT_ID,
        projectId: project.id,
        type: "SALE",
        amount,
        rate,
        statementDate: addDays(project.soldDate ?? now, randInt(10, 30)),
        paid: Math.random() > 0.3,
      },
    });
    if (Math.random() > 0.7) {
      await prisma.projectCommission.create({
        data: {
          tenantId: TENANT_ID,
          projectId: project.id,
          type: "REFERRAL",
          amount: randInt(150, 500),
          statementDate: addDays(project.soldDate ?? now, randInt(10, 30)),
          paid: Math.random() > 0.5,
        },
      });
    }
  }

  console.log("Seeding service tickets...");
  const completedProjects = projects.filter((p) => p.status === "COMPLETE" || p.status === "UTILITY_PTO");
  const ticketPool = completedProjects.length > 0 ? completedProjects : projects;
  const ticketProjects = [...ticketPool].sort(() => Math.random() - 0.5).slice(0, 6);
  const ticketStatuses: (typeof SERVICE_TICKET_STATUSES)[number][] = [
    "OPEN", "SCHEDULED", "IN_PROGRESS", "RESOLVED", "RESOLVED", "CLOSED",
  ];
  for (let i = 0; i < ticketProjects.length; i++) {
    const project = ticketProjects[i];
    const status = ticketStatuses[i];
    const reportedAt = addDays(now, -randInt(2, 45));
    await prisma.serviceTicket.create({
      data: {
        tenantId: TENANT_ID,
        projectId: project.id,
        ticketNumber: `SVC-${randInt(10000, 99999)}`,
        issueType: pick(SERVICE_ISSUE_TYPES),
        status,
        description: pick([
          "Production monitoring shows underperformance vs. estimate",
          "Inverter fault code reported by monitoring app",
          "Customer reports minor roof leak near array mounts",
          "Homeowner requests replacement of failed micro-inverter",
          "Billing discrepancy on net metering credits",
          "Annual warranty inspection requested by customer",
        ]),
        reportedAt,
        resolvedAt: status === "RESOLVED" || status === "CLOSED" ? addDays(reportedAt, randInt(1, 14)) : null,
        technicianName: pick(["Marcus Ellery", "Sofia Reyes", "Ben Larkin", "Chidi Obasi"]),
        technicianPhone: `(${randInt(200, 999)}) ${randInt(200, 999)}-${randInt(1000, 9999)}`,
        costAmount: Math.random() > 0.5 ? randInt(0, 800) : undefined,
        warrantyCovered: Math.random() > 0.2,
      },
    });
  }

  console.log(
    `Done. ${vendors.length} vendors, ${contacts.length} contacts, ${companies.length} companies, ${projects.length} projects.`,
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
