import { z } from "zod";
import { zId } from "@/lib/validation";
import { createTRPCRouter, authedProcedure } from "@/server/api/trpc";

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
    .mutation(({ ctx, input }) =>
      ctx.db.todo.update({ where: { id: input.id }, data: { completed: input.completed } }),
    ),

  move: authedProcedure
    .input(z.object({ id: zId, quadrant: quadrantSchema }))
    .mutation(({ ctx, input }) =>
      ctx.db.todo.update({ where: { id: input.id }, data: { quadrant: input.quadrant } }),
    ),

  delete: authedProcedure
    .input(z.object({ id: zId }))
    .mutation(({ ctx, input }) => ctx.db.todo.delete({ where: { id: input.id } })),
});
