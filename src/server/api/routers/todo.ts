import { z } from "zod";
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
    .input(z.object({ title: z.string().min(1), quadrant: quadrantSchema }))
    .mutation(({ ctx, input }) =>
      ctx.db.todo.create({
        data: { ...input, authorId: ctx.userId },
      }),
    ),

  toggle: authedProcedure
    .input(z.object({ id: z.string(), completed: z.boolean() }))
    .mutation(({ ctx, input }) =>
      ctx.db.todo.update({ where: { id: input.id }, data: { completed: input.completed } }),
    ),

  move: authedProcedure
    .input(z.object({ id: z.string(), quadrant: quadrantSchema }))
    .mutation(({ ctx, input }) =>
      ctx.db.todo.update({ where: { id: input.id }, data: { quadrant: input.quadrant } }),
    ),

  delete: authedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.db.todo.delete({ where: { id: input.id } })),
});
