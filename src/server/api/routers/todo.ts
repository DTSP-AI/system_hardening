import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "@/server/api/trpc";

const quadrantSchema = z.enum(["URGENT_IMPORTANT", "SCHEDULE", "DELEGATE", "BACK_BURNER"]);

export const todoRouter = createTRPCRouter({
  list: tenantProcedure.query(({ ctx }) =>
    ctx.db.todo.findMany({
      where: { authorId: ctx.userId },
      orderBy: { createdAt: "asc" },
    }),
  ),

  create: tenantProcedure
    .input(z.object({ title: z.string().min(1), quadrant: quadrantSchema }))
    .mutation(({ ctx, input }) =>
      ctx.db.todo.create({
        data: { ...input, authorId: ctx.userId },
      }),
    ),

  toggle: tenantProcedure
    .input(z.object({ id: z.string(), completed: z.boolean() }))
    .mutation(({ ctx, input }) =>
      ctx.db.todo.update({ where: { id: input.id }, data: { completed: input.completed } }),
    ),

  move: tenantProcedure
    .input(z.object({ id: z.string(), quadrant: quadrantSchema }))
    .mutation(({ ctx, input }) =>
      ctx.db.todo.update({ where: { id: input.id }, data: { quadrant: input.quadrant } }),
    ),

  delete: tenantProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.db.todo.delete({ where: { id: input.id } })),
});
