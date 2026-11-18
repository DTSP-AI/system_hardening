import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const { prisma } = await import("@/lib/db");
  const tenants = await prisma.tenant.findMany({ include: { memberships: true } });
  for (const t of tenants) {
    console.log("Tenant:", t.id, t.name, t.slug);
    for (const m of t.memberships) {
      console.log("  Member:", m.clerkUserId, m.role);
    }
    const contacts = await prisma.contact.findMany({ where: { tenantId: t.id }, take: 5 });
    console.log("  Contacts sample:", contacts.map((c) => `${c.id}:${c.firstName} ${c.lastName}`));
    const deals = await prisma.deal.findMany({ where: { tenantId: t.id }, take: 5 });
    console.log("  Deals sample:", deals.map((d) => `${d.id}:${d.name}`));
    const todos = await prisma.todo.findMany({ where: { tenantId: t.id }, take: 5 });
    console.log("  Todos sample:", todos.map((td) => `${td.id}:${td.authorId}:${td.title}`));
  }
  await prisma.$disconnect();
}
main();
