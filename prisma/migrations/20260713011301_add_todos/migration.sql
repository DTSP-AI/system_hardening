-- CreateEnum
CREATE TYPE "TodoQuadrant" AS ENUM ('URGENT_IMPORTANT', 'SCHEDULE', 'DELEGATE', 'BACK_BURNER');

-- CreateTable
CREATE TABLE "todos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "quadrant" "TodoQuadrant" NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "todos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "todos_tenantId_idx" ON "todos"("tenantId");

-- CreateIndex
CREATE INDEX "todos_authorId_idx" ON "todos"("authorId");

-- AddForeignKey
ALTER TABLE "todos" ADD CONSTRAINT "todos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
