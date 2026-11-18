-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('CUSTOMER', 'VENDOR', 'PARTNER');

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "type" "ContactType" NOT NULL DEFAULT 'CUSTOMER';
