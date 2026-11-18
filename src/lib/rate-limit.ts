import { prisma } from "@/lib/db";

export type RateLimitWindow = { windowMs: number; max: number };
export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/** Pure: the largest window length, used as the prune horizon. */
export function largestWindowMs(windows: readonly RateLimitWindow[]): number {
  return windows.reduce((m, w) => Math.max(m, w.windowMs), 0);
}

/** Pure: seconds until the oldest hit in the window ages out, at least 1. */
export function computeRetryAfterSeconds(
  oldestCreatedAtMs: number,
  windowMs: number,
  nowMs: number,
): number {
  return Math.max(1, Math.ceil((oldestCreatedAtMs + windowMs - nowMs) / 1000));
}

/**
 * Sliding-window limiter backed by the rate_limit_hits table.
 *
 * Insert-then-count with two separate, sequential statements on the bare
 * client: the insert commits before the count runs, so concurrent bursts
 * always see each other's rows. Do NOT merge into one statement and do NOT
 * run on a request transaction client. DB errors are thrown; callers fail closed.
 */
export async function consumeRateLimit(
  key: string,
  windows: readonly RateLimitWindow[],
): Promise<RateLimitDecision> {
  const nowMs = Date.now();
  const now = new Date(nowMs);
  const maxWindow = largestWindowMs(windows);

  const row = await prisma.rateLimitHit.create({
    data: { key, createdAt: now },
    select: { id: true },
  });

  for (const w of windows) {
    const since = new Date(nowMs - w.windowMs);
    const count = await prisma.rateLimitHit.count({
      where: { key, createdAt: { gt: since } },
    });
    if (count > w.max) {
      try {
        await prisma.rateLimitHit.delete({ where: { id: row.id } });
      } catch (err) {
        console.error("rate-limit: failed to delete rejected hit", err);
      }
      const oldest = await prisma.rateLimitHit.findFirst({
        where: { key, createdAt: { gt: since } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      });
      const oldestMs = oldest ? oldest.createdAt.getTime() : nowMs;
      return {
        allowed: false,
        retryAfterSeconds: computeRetryAfterSeconds(oldestMs, w.windowMs, nowMs),
      };
    }
  }

  try {
    await prisma.rateLimitHit.deleteMany({
      where: { key, createdAt: { lt: new Date(nowMs - maxWindow) } },
    });
  } catch (err) {
    console.error("rate-limit: prune failed", err);
  }

  return { allowed: true };
}
