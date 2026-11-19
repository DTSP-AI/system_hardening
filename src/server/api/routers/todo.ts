import { z } from "zod";
import { zId } from "@/lib/validation";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, authedProcedure } from "@/server/api/trpc";

/** Throws NOT_FOUND unless exactly one row was changed (covers missing and other-user rows alike). */
function assertOwned(count: number) {
  if (count !== 1) throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
}

const quadrantSchema = z.enum(["URGENT_IMPORTANT", "SCHEDULE", "DELEGATE", "BACK_BURNER"]);

export const todoRouter = createTRPCRouter({
  list: authedProcedure.query(({ ctx }) =>
    ctx.db.todo.findMany({
      where: { authorId: ctx.userId },
      orderBy: { createdAt: "asc" },
    }),
  ),

  create: authedProcedure
    .input(z.object({ title: z.string().min(1).max(500), quadrant: quadrantSchema }))
    .mutation(({ ctx, input }) =>
      ctx.db.todo.create({
        data: { ...input, authorId: ctx.userId },
      }),
    ),

  toggle: authedProcedure
    .input(z.object({ id: zId, completed: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const r = await ctx.db.todo.updateMany({
        where: { id: input.id, authorId: ctx.userId },
        data: { completed: input.completed },
      });
      assertOwned(r.count);
      return { id: input.id };
    }),

  move: authedProcedure
    .input(z.object({ id: zId, quadrant: quadrantSchema }))
    .mutation(async ({ ctx, input }) => {
      const r = await ctx.db.todo.updateMany({
        where: { id: input.id, authorId: ctx.userId },
        data: { quadrant: input.quadrant },
      });
      assertOwned(r.count);
      return { id: input.id };
    }),

  delete: authedProcedure
    .input(z.object({ id: zId }))
    .mutation(async ({ ctx, input }) => {
      const r = await ctx.db.todo.deleteMany({ where: { id: input.id, authorId: ctx.userId } });
      assertOwned(r.count);
      return { id: input.id };
    }),
});
