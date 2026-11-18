-- CreateEnum
CREATE TYPE "VendorType" AS ENUM ('PANEL_MANUFACTURER', 'INVERTER_MANUFACTURER', 'BATTERY_MANUFACTURER', 'RACKING_MANUFACTURER', 'DISTRIBUTOR', 'OTHER');

-- CreateEnum
CREATE TYPE "FinancingType" AS ENUM ('CASH', 'LOAN', 'LEASE', 'PPA');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('SOLD', 'SITE_SURVEY', 'DESIGN', 'PERMITTING', 'SCHEDULED', 'INSTALLING', 'INSTALLED', 'INSPECTION', 'UTILITY_PTO', 'COMPLETE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProjectCommissionType" AS ENUM ('SALE', 'REFERRAL', 'BONUS', 'CHARGEBACK');

-- CreateEnum
CREATE TYPE "ServiceIssueType" AS ENUM ('PERFORMANCE', 'EQUIPMENT_FAILURE', 'ROOF_LEAK', 'MONITORING', 'BILLING', 'WARRANTY', 'OTHER');

-- CreateEnum
CREATE TYPE "ServiceTicketStatus" AS ENUM ('OPEN', 'SCHEDULED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'PROJECT_STATUS_CHANGE';
ALTER TYPE "NotificationType" ADD VALUE 'SERVICE_TICKET_STATUS_CHANGE';

-- AlterEnum
ALTER TYPE "TaggableEntityType" ADD VALUE 'PROJECT';

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "projectId" TEXT;

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "VendorType" NOT NULL DEFAULT 'OTHER',
    "phone" TEXT,
    "website" TEXT,
    "portalUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectNumber" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'SOLD',
    "financingType" "FinancingType" NOT NULL DEFAULT 'LOAN',
    "systemSizeKw" DECIMAL(6,2) NOT NULL,
    "panelCount" INTEGER NOT NULL,
    "contractAmount" DECIMAL(12,2) NOT NULL,
    "panelVendorId" TEXT,
    "inverterVendorId" TEXT,
    "installAddressLine1" TEXT,
    "installAddressLine2" TEXT,
    "installCity" TEXT,
    "installState" TEXT,
    "installPostalCode" TEXT,
    "contactId" TEXT,
    "companyId" TEXT,
    "ownerId" TEXT,
    "soldDate" TIMESTAMP(3),
    "siteSurveyDate" TIMESTAMP(3),
    "permitSubmittedDate" TIMESTAMP(3),
    "permitApprovedDate" TIMESTAMP(3),
    "installStartDate" TIMESTAMP(3),
    "installCompleteDate" TIMESTAMP(3),
    "inspectionDate" TIMESTAMP(3),
    "ptoDate" TIMESTAMP(3),
    "customFields" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_commissions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "ProjectCommissionType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "rate" DECIMAL(5,2),
    "statementDate" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_tickets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "issueType" "ServiceIssueType" NOT NULL DEFAULT 'OTHER',
    "status" "ServiceTicketStatus" NOT NULL DEFAULT 'OPEN',
    "description" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "technicianName" TEXT,
    "technicianPhone" TEXT,
    "costAmount" DECIMAL(12,2),
    "warrantyCovered" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendors_tenantId_idx" ON "vendors"("tenantId");

-- CreateIndex
CREATE INDEX "projects_tenantId_idx" ON "projects"("tenantId");

-- CreateIndex
CREATE INDEX "projects_panelVendorId_idx" ON "projects"("panelVendorId");

-- CreateIndex
CREATE INDEX "projects_inverterVendorId_idx" ON "projects"("inverterVendorId");

-- CreateIndex
CREATE INDEX "projects_contactId_idx" ON "projects"("contactId");

-- CreateIndex
CREATE INDEX "projects_companyId_idx" ON "projects"("companyId");

-- CreateIndex
CREATE INDEX "projects_ptoDate_idx" ON "projects"("ptoDate");

-- CreateIndex
CREATE INDEX "project_commissions_tenantId_idx" ON "project_commissions"("tenantId");

-- CreateIndex
CREATE INDEX "project_commissions_projectId_idx" ON "project_commissions"("projectId");

-- CreateIndex
CREATE INDEX "service_tickets_tenantId_idx" ON "service_tickets"("tenantId");

-- CreateIndex
CREATE INDEX "service_tickets_projectId_idx" ON "service_tickets"("projectId");

-- CreateIndex
CREATE INDEX "activities_projectId_idx" ON "activities"("projectId");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_panelVendorId_fkey" FOREIGN KEY ("panelVendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_inverterVendorId_fkey" FOREIGN KEY ("inverterVendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_commissions" ADD CONSTRAINT "project_commissions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_commissions" ADD CONSTRAINT "project_commissions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
