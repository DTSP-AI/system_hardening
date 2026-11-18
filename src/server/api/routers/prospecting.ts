import { z } from "zod";
import { createTRPCRouter, authedProcedure } from "@/server/api/trpc";

const CATEGORIES = [
  "HVAC",
  "Plumbing",
  "Electrical",
  "Roofing",
  "General Contractor",
  "Pest Control",
  "Landscaping",
  "Dental",
  "Veterinary",
  "Real Estate",
] as const;

const STREET_NAMES = ["Main St", "Oak Ave", "Commerce Dr", "Industrial Pkwy", "Broadway", "1st St"];
const OWNER_FIRST_NAMES = ["James", "Maria", "Robert", "Linda", "David", "Susan", "Michael", "Karen"];
const OWNER_LAST_NAMES = ["Johnson", "Garcia", "Smith", "Williams", "Brown", "Davis", "Miller", "Wilson"];

function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 0xffffffff;
  };
}

function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

const prospectingInput = z.object({
  location: z.string().min(1),
  industry: z.string().min(1),
  radiusMiles: z.number().min(1).max(100).default(25),
  tier: z.enum(["basic", "premium"]).default("basic"),
});

export const prospectingRouter = createTRPCRouter({
  // STUB: fixture data seeded from the search inputs so results look stable
  // across re-renders of the same search. Swap for a real Google Places
  // (New) call once wired -- see src/server/places.ts in ybryx-grader for
  // the field-mask pattern to adapt.
  search: authedProcedure.input(prospectingInput).query(({ input }) => {
    const rand = seededRandom(`${input.location}|${input.industry}|${input.tier}`);
    const count = 15 + Math.floor(rand() * 6);

    return Array.from({ length: count }, (_, i) => {
      const category = input.industry || pick(rand, CATEGORIES);
      const businessName = `${pick(rand, OWNER_LAST_NAMES)} ${category}`;
      const streetNumber = 100 + Math.floor(rand() * 9000);
      const address = `${streetNumber} ${pick(rand, STREET_NAMES)}, ${input.location}`;
      const phone = `(${200 + Math.floor(rand() * 700)}) ${100 + Math.floor(rand() * 900)}-${1000 + Math.floor(rand() * 9000)}`;
      const rating = Math.round((3 + rand() * 2) * 10) / 10;
      const reviewCount = Math.floor(rand() * 250);

      const premium = input.tier === "premium";
      const ownerName = premium ? `${pick(rand, OWNER_FIRST_NAMES)} ${pick(rand, OWNER_LAST_NAMES)}` : undefined;

      return {
        id: `stub-${input.location}-${input.industry}-${i}`,
        businessName,
        address,
        phone,
        category,
        rating,
        reviewCount,
        tier: input.tier,
        ownerName,
        ownerEmail: premium
          ? `${ownerName!.toLowerCase().replace(" ", ".")}@${businessName.toLowerCase().replace(/\s+/g, "")}.com`
          : undefined,
        contactSource: premium ? "stub" : undefined,
      };
    });
  }),
});
