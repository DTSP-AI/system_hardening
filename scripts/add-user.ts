import dotenv from "dotenv";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { z } from "zod";
import { PrismaClient } from "../generated/prisma/client";

const ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;
type Role = (typeof ROLES)[number];

const USAGE = `Usage:
  add-user <email> <OWNER|ADMIN|MEMBER> [--name "..."]
  add-user deactivate <email>
  add-user reactivate <email>
  add-user unlink <email>`;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function usageFail(message?: string): never {
  fail(message ? `${message}\n${USAGE}` : USAGE);
}

function parseEmail(raw: string | undefined): string {
  if (!raw) usageFail();
  const parsed = z.string().email().safeParse(raw.trim().toLowerCase());
  if (!parsed.success) usageFail("Invalid email address.");
  return parsed.data;
}

type Command =
  | { kind: "upsert"; email: string; role: Role; name?: string }
  | { kind: "deactivate" | "reactivate" | "unlink"; email: string };

function parseArgs(argv: string[]): Command {
  const args = [...argv];
  let name: string | undefined;
  const nameIdx = args.indexOf("--name");
  if (nameIdx !== -1) {
    const value = args[nameIdx + 1];
    if (value === undefined) usageFail("--name requires a value.");
    name = value.trim() || undefined;
    args.splice(nameIdx, 2);
  }
  if (args.length === 0) usageFail();

  const [first, second, ...rest] = args;
  if (first === "deactivate" || first === "reactivate" || first === "unlink") {
    if (rest.length > 0 || name !== undefined) usageFail();
    return { kind: first, email: parseEmail(second) };
  }

  if (rest.length > 0) usageFail();
  const email = parseEmail(first);
  if (!second || !(ROLES as readonly string[]).includes(second)) {
    usageFail(`Role must be one of: ${ROLES.join(", ")}.`);
  }
  return { kind: "upsert", email, role: second as Role, name };
}

async function main() {
  const cmd = parseArgs(process.argv.slice(2));

  dotenv.config({ path: ".env.local", quiet: true });
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) fail("DATABASE_URL is not set.");

  neonConfig.webSocketConstructor = ws;
  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

  try {
    const activeOwnersExcluding = (id: string) =>
      prisma.user.count({ where: { role: "OWNER", deactivatedAt: null, id: { not: id } } });

    if (cmd.kind === "upsert") {
      const existing = await prisma.user.findUnique({ where: { email: cmd.email } });
      if (
        existing &&
        existing.role === "OWNER" &&
        cmd.role !== "OWNER" &&
        !existing.deactivatedAt &&
        (await activeOwnersExcluding(existing.id)) === 0
      ) {
        fail("Refused: this would leave zero active OWNERs.");
      }
      const user = await prisma.user.upsert({
        where: { email: cmd.email },
        create: { email: cmd.email, role: cmd.role, name: cmd.name },
        update: { role: cmd.role, ...(cmd.name ? { name: cmd.name } : {}) },
      });
      console.log(
        `${existing ? "updated" : "created"} ${user.id} role=${user.role} linked=${user.clerkUserId ? "yes" : "no"}`,
      );
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email: cmd.email } });
    if (!existing) fail("No such user.");

    if (cmd.kind === "deactivate") {
      if (
        existing.role === "OWNER" &&
        !existing.deactivatedAt &&
        (await activeOwnersExcluding(existing.id)) === 0
      ) {
        fail("Refused: this would leave zero active OWNERs.");
      }
    }

    const data =
      cmd.kind === "deactivate"
        ? { deactivatedAt: new Date() }
        : cmd.kind === "reactivate"
          ? { deactivatedAt: null }
          : { clerkUserId: null };
    const user = await prisma.user.update({ where: { id: existing.id }, data });
    const verb = { deactivate: "deactivated", reactivate: "reactivated", unlink: "unlinked" }[cmd.kind];
    console.log(
      `${verb} ${user.id} role=${user.role} linked=${user.clerkUserId ? "yes" : "no"}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error("add-user failed.");
  process.exit(1);
});
