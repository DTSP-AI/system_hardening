-- CreateEnum
CREATE TYPE "LineOfBusiness" AS ENUM ('PERSONAL_AUTO', 'HOMEOWNERS', 'RENTERS', 'CONDO', 'DWELLING_FIRE', 'PERSONAL_UMBRELLA', 'MOTORCYCLE', 'BOAT', 'RV', 'FLOOD', 'COMMERCIAL_AUTO', 'GENERAL_LIABILITY', 'COMMERCIAL_PROPERTY', 'BOP', 'WORKERS_COMP', 'COMMERCIAL_UMBRELLA', 'PROFESSIONAL_LIABILITY', 'CYBER', 'INLAND_MARINE', 'OTHER');

-- CreateEnum
CREATE TYPE "PolicyStatus" AS ENUM ('QUOTE', 'ACTIVE', 'PENDING_RENEWAL', 'RENEWED', 'CANCELLED', 'NON_RENEWED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BillingType" AS ENUM ('DIRECT_BILL', 'AGENCY_BILL');

-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('NEW_BUSINESS', 'RENEWAL', 'CHARGEBACK', 'BONUS');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('OPEN', 'CLOSED', 'DENIED', 'REOPENED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'POLICY_STATUS_CHANGE';
ALTER TYPE "NotificationType" ADD VALUE 'CLAIM_STATUS_CHANGE';

-- AlterEnum
ALTER TYPE "TaggableEntityType" ADD VALUE 'POLICY';

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "policyId" TEXT;

-- CreateTable
CREATE TABLE "carriers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "naicCode" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "portalUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carriers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "lineOfBusiness" "LineOfBusiness" NOT NULL,
    "status" "PolicyStatus" NOT NULL DEFAULT 'QUOTE',
    "billingType" "BillingType" NOT NULL DEFAULT 'DIRECT_BILL',
    "premium" DECIMAL(12,2) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "expirationDate" TIMESTAMP(3) NOT NULL,
    "carrierId" TEXT NOT NULL,
    "contactId" TEXT,
    "companyId" TEXT,
    "ownerId" TEXT,
    "renewedFromId" TEXT,
    "customFields" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commissions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "type" "CommissionType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "rate" DECIMAL(5,2),
    "statementDate" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claims" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "claimNumber" TEXT NOT NULL,
    "dateOfLoss" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "status" "ClaimStatus" NOT NULL DEFAULT 'OPEN',
    "reserveAmount" DECIMAL(12,2),
    "paidAmount" DECIMAL(12,2),
    "adjusterName" TEXT,
    "adjusterPhone" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "carriers_tenantId_idx" ON "carriers"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "policies_renewedFromId_key" ON "policies"("renewedFromId");

-- CreateIndex
CREATE INDEX "policies_tenantId_idx" ON "policies"("tenantId");

-- CreateIndex
CREATE INDEX "policies_carrierId_idx" ON "policies"("carrierId");

-- CreateIndex
CREATE INDEX "policies_contactId_idx" ON "policies"("contactId");

-- CreateIndex
CREATE INDEX "policies_companyId_idx" ON "policies"("companyId");

-- CreateIndex
CREATE INDEX "policies_expirationDate_idx" ON "policies"("expirationDate");

-- CreateIndex
CREATE INDEX "commissions_tenantId_idx" ON "commissions"("tenantId");

-- CreateIndex
CREATE INDEX "commissions_policyId_idx" ON "commissions"("policyId");

-- CreateIndex
CREATE INDEX "claims_tenantId_idx" ON "claims"("tenantId");

-- CreateIndex
CREATE INDEX "claims_policyId_idx" ON "claims"("policyId");

-- CreateIndex
CREATE INDEX "activities_policyId_idx" ON "activities"("policyId");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carriers" ADD CONSTRAINT "carriers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_renewedFromId_fkey" FOREIGN KEY ("renewedFromId") REFERENCES "policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
