import { z } from "zod";
import { randomBytes, createHash } from "crypto";
import { createTRPCRouter, adminProcedure } from "@/server/api/trpc";

function generateKey() {
  return `bos1_${randomBytes(24).toString("base64url")}`;
}

function hashKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export const apiKeyRouter = createTRPCRouter({
  list: adminProcedure.query(({ ctx }) =>
    ctx.db.apiKey.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        createdByUserId: true,
        expiresAt: true,
        revokedAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
    }),
  ),

  create: adminProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const key = generateKey();
      const apiKey = await ctx.db.apiKey.create({
        data: {
          name: input.name,
          hashedKey: hashKey(key),
          createdByUserId: ctx.userId,
        },
      });
      // Raw key is only ever returned here -- only the hash is persisted.
      return { id: apiKey.id, key };
    }),

  revoke: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.apiKey.update({ where: { id: input.id }, data: { revokedAt: new Date() } }),
    ),
});
