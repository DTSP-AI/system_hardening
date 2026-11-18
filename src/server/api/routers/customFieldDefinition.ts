import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, authedProcedure, adminProcedure } from "@/server/api/trpc";
import { logAudit, toJsonSafe } from "@/lib/audit";

const entityTypeSchema = z.enum(["CONTACT", "COMPANY", "DEAL"]);
const fieldTypeSchema = z.enum(["TEXT", "NUMBER", "DATE", "SELECT", "BOOLEAN"]);

export const customFieldDefinitionRouter = createTRPCRouter({
  list: authedProcedure.query(({ ctx }) =>
    ctx.db.customFieldDefinition.findMany({
      orderBy: [{ entityType: "asc" }, { sortOrder: "asc" }],
    }),
  ),

  create: adminProcedure
    .input(
      z.object({
        entityType: entityTypeSchema,
        key: z
          .string()
          .min(1)
          .regex(/^[a-z][a-zA-Z0-9_]*$/, "Use camelCase, starting with a lowercase letter"),
        label: z.string().min(1),
        fieldType: fieldTypeSchema,
        options: z.array(z.string()).default([]),
        required: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { _max } = await ctx.db.customFieldDefinition.aggregate({
        _max: { sortOrder: true },
        where: { entityType: input.entityType },
      });
      try {
        const created = await ctx.db.customFieldDefinition.create({
          data: { ...input, sortOrder: (_max.sortOrder ?? -1) + 1 },
        });
        await logAudit(ctx.db, {
          actorId: ctx.userId,
          entityType: "CUSTOM_FIELD_DEFINITION",
          entityId: created.id,
          action: "CREATE",
          diff: toJsonSafe(created),
        });
        return created;
      } catch (err) {
        if (err instanceof Error && err.message.includes("Unique constraint")) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `A field with key "${input.key}" already exists for this entity type`,
          });
        }
        throw err;
      }
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        label: z.string().min(1).optional(),
        options: z.array(z.string()).optional(),
        required: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const updated = await ctx.db.customFieldDefinition.update({ where: { id }, data });
      await logAudit(ctx.db, {
        actorId: ctx.userId,
        entityType: "CUSTOM_FIELD_DEFINITION",
        entityId: id,
        action: "UPDATE",
        diff: toJsonSafe(data),
      });
      return updated;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db.customFieldDefinition.delete({ where: { id: input.id } });
      await logAudit(ctx.db, {
        actorId: ctx.userId,
        entityType: "CUSTOM_FIELD_DEFINITION",
        entityId: input.id,
        action: "DELETE",
        diff: toJsonSafe(deleted),
      });
      return deleted;
    }),
});
