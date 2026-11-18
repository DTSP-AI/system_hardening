-- CreateEnum
CREATE TYPE "CoachingSessionStatus" AS ENUM ('ACTIVE', 'ENDED', 'ERROR');

-- CreateTable
CREATE TABLE "call_coaching_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "callSid" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactId" TEXT,
    "dealId" TEXT,
    "status" "CoachingSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "transcript" JSONB NOT NULL DEFAULT '[]',
    "tips" JSONB NOT NULL DEFAULT '[]',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "call_coaching_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "call_coaching_sessions_tenantId_idx" ON "call_coaching_sessions"("tenantId");

-- CreateIndex
CREATE INDEX "call_coaching_sessions_callSid_idx" ON "call_coaching_sessions"("callSid");

-- AddForeignKey
ALTER TABLE "call_coaching_sessions" ADD CONSTRAINT "call_coaching_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
