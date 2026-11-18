import { prisma } from "@/lib/db";

/**
 * Atomically merges `patch` into a CALL activity's metadata (jsonb `||`), and
 * optionally replaces its body. The status and recording callbacks land at
 * about the same time; a read-modify-write in either would lose the other's
 * fields. Returns the number of rows affected (0 = no such CALL activity).
 */
export async function mergeCallMetadata(
  activityId: string,
  patch: Record<string, string | number>,
  body?: string,
): Promise<number> {
  const patchJson = JSON.stringify(patch);
  if (body !== undefined) {
    return prisma.$executeRaw`UPDATE "activities" SET "metadata" = "metadata" || ${patchJson}::jsonb, "body" = ${body} WHERE "id" = ${activityId} AND "type" = 'CALL'::"ActivityType"`;
  }
  return prisma.$executeRaw`UPDATE "activities" SET "metadata" = "metadata" || ${patchJson}::jsonb WHERE "id" = ${activityId} AND "type" = 'CALL'::"ActivityType"`;
}
