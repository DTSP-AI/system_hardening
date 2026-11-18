-- CreateEnum
CREATE TYPE "DealPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "state" TEXT;

-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "description" TEXT,
ADD COLUMN     "nextStep" TEXT,
ADD COLUMN     "priority" "DealPriority" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "source" TEXT;
