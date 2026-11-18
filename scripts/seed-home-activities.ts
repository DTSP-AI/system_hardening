import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const TENANT_ID = "cmriips4k000004l5r29x1lu2";
const AUTHOR_ID = "user_3GQNb8QyFEeERFR8QGCAzEZWKmK";

const CONTACTS = {
  joshua: "cmriloagx000104k2zyai08kj",
  maya: "cmrim7rm3000kw9dpft96je12",
  ruby: "cmrim7rnh000lw9dpfl2b2v8x",
  theo: "cmrim7roj000mw9dpn1gm4gyc",
  marcus: "cmrim7rpm000nw9dp7o0rcb3f",
};

const DEALS = {
  mercerNewLocation: "cmrim7s800014w9dpacyeeein",
  mercerSeasonal: "cmrim7sa20015w9dpdlils1mp",
  novakFinancing: "cmrim7sb70016w9dp9mfc693g",
  okaforTradeIn: "cmrim7scd0017w9dptgyn8jlj",
  whitfieldFleet: "cmrim7sdi0018w9dp5l2f1ebg",
};

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

function todayAt(hour: number, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  const { prisma } = await import("@/lib/db");

  await prisma.activity.createMany({
    data: [
      {
        tenantId: TENANT_ID,
        authorId: AUTHOR_ID,
        type: "CALL",
        contactId: CONTACTS.ruby,
        createdAt: hoursAgo(2),
        metadata: { status: "no-answer" },
      },
      {
        tenantId: TENANT_ID,
        authorId: AUTHOR_ID,
        type: "CALL",
        contactId: CONTACTS.marcus,
        createdAt: hoursAgo(19),
        metadata: { status: "no-answer" },
      },
      {
        tenantId: TENANT_ID,
        authorId: AUTHOR_ID,
        type: "CALL",
        contactId: CONTACTS.theo,
        createdAt: hoursAgo(5),
        metadata: { status: "busy" },
      },
      {
        tenantId: TENANT_ID,
        authorId: AUTHOR_ID,
        type: "EMAIL",
        contactId: CONTACTS.maya,
        body: "Re: Fleet Expansion financing terms — following up on the rate lock",
        createdAt: hoursAgo(3),
      },
      {
        tenantId: TENANT_ID,
        authorId: AUTHOR_ID,
        type: "EMAIL",
        contactId: CONTACTS.ruby,
        body: "Signed paperwork attached for review",
        createdAt: hoursAgo(20),
      },
      {
        tenantId: TENANT_ID,
        authorId: AUTHOR_ID,
        type: "EMAIL",
        contactId: CONTACTS.marcus,
        body: "Question about trade-in valuation before we sign",
        createdAt: hoursAgo(27),
      },
      {
        tenantId: TENANT_ID,
        authorId: AUTHOR_ID,
        type: "MEETING",
        contactId: CONTACTS.maya,
        dealId: DEALS.whitfieldFleet,
        dueDate: todayAt(10, 30),
        body: "Fleet expansion walkthrough",
      },
      {
        tenantId: TENANT_ID,
        authorId: AUTHOR_ID,
        type: "MEETING",
        contactId: CONTACTS.ruby,
        dueDate: todayAt(13, 0),
        body: "Contract review call",
      },
      {
        tenantId: TENANT_ID,
        authorId: AUTHOR_ID,
        type: "MEETING",
        contactId: CONTACTS.theo,
        dealId: DEALS.novakFinancing,
        dueDate: todayAt(15, 30),
        body: "Financing package discussion",
      },
      {
        tenantId: TENANT_ID,
        authorId: AUTHOR_ID,
        type: "MEETING",
        contactId: CONTACTS.marcus,
        dueDate: todayAt(16, 45),
        body: "Intro call — trade-in options",
      },
      {
        tenantId: TENANT_ID,
        authorId: AUTHOR_ID,
        type: "MEETING",
        contactId: CONTACTS.joshua,
        dealId: DEALS.mercerNewLocation,
        dueDate: todayAt(9, 0),
        body: "New location buildout kickoff",
      },
    ],
  });

  console.log("Seeded 3 missed calls, 3 emails, 5 meetings.");
  await prisma.$disconnect();
}
main();
