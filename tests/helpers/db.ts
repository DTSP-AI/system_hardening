/**
 * Test database client. Import this BEFORE any module that imports "@/lib/db":
 * it places a local-Postgres Prisma client on globalThis, which src/lib/db.ts
 * reuses instead of creating its Neon client.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { DEFAULT_TEST_DATABASE_URL, assertLocalDatabaseUrl } from "./test-db-url";

const url = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
assertLocalDatabaseUrl(url);

export const testDb = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

(globalThis as unknown as { prisma?: PrismaClient }).prisma = testDb;

/** Empties every application table. */
export async function resetDb(): Promise<void> {
  const tables = await testDb.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await testDb.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export async function closeDb(): Promise<void> {
  await testDb.$disconnect();
}
