import { z } from "zod";
import { createTRPCRouter, authedProcedure } from "@/server/api/trpc";

export const searchRouter = createTRPCRouter({
  global: authedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const q = input.query;
      const [contacts, companies, deals, leads] = await Promise.all([
        ctx.db.contact.findMany({
          where: {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 5,
          select: { id: true, firstName: true, lastName: true, email: true },
        }),
        ctx.db.company.findMany({
          where: { name: { contains: q, mode: "insensitive" } },
          take: 5,
          select: { id: true, name: true, domain: true },
        }),
        ctx.db.deal.findMany({
          where: { name: { contains: q, mode: "insensitive" } },
          take: 5,
          select: { id: true, name: true, amount: true },
        }),
        ctx.db.lead.findMany({
          where: {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { companyName: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 5,
          select: { id: true, firstName: true, lastName: true, companyName: true },
        }),
      ]);

      return { contacts, companies, deals, leads };
    }),
});
