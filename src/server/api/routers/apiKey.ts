import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { zId, zName } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { generateApiKey, hashApiKey } from "@/lib/auth/api-key";
import { API_KEY_SCOPES } from "@/lib/auth/api-key-scopes";
import { createTRPCRouter, adminProcedure } from "@/server/api/trpc";

export const apiKeyRouter = createTRPCRouter({
  list: adminProcedure.query(({ ctx }) =>
    ctx.db.apiKey.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        scopes: true,
        createdByUserId: true,
        expiresAt: true,
        revokedAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
    }),
  ),

  create: adminProcedure
    .input(
      z.object({
        name: zName,
        scopes: z
          .array(z.enum(API_KEY_SCOPES))
          .min(1, "Choose at least one permission")
          .max(API_KEY_SCOPES.length),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const key = generateApiKey();
      const scopes = [...new Set(input.scopes)];
      const apiKey = await ctx.db.apiKey.create({
        data: {
          name: input.name,
          hashedKey: hashApiKey(key),
          scopes,
          createdByUserId: ctx.userId,
        },
      });
      // The audit row never carries the key or its hash.
      await logAudit(ctx.db, {
        actorId: ctx.userId,
        entityType: "API_KEY",
        entityId: apiKey.id,
        action: "CREATE",
        diff: { name: apiKey.name, scopes },
      });
      // Raw key is only ever returned here -- only the hash is persisted.
      return { id: apiKey.id, key };
    }),

  revoke: adminProcedure
    .input(z.object({ id: zId }))
    .mutation(async ({ ctx, input }) => {
      // Only a key that is not yet revoked is stamped, so a repeat keeps the first time.
      const changed = await ctx.db.apiKey.updateMany({
        where: { id: input.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const key = await ctx.db.apiKey.findUnique({
        where: { id: input.id },
        select: { id: true, name: true, revokedAt: true },
      });
      if (!key) throw new TRPCError({ code: "NOT_FOUND", message: "API key not found" });
      if (changed.count === 1) {
        await logAudit(ctx.db, {
          actorId: ctx.userId,
          entityType: "API_KEY",
          entityId: key.id,
          action: "UPDATE",
          diff: { revoked: true },
        });
      }
      return key;
    }),
});
