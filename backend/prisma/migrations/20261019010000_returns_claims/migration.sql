-- CreateEnum
CREATE TYPE "FaultParty" AS ENUM ('SHOP', 'CARRIER', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('REQUESTED', 'COMPENSATED', 'REJECTED');

-- AlterTable
ALTER TABLE "ReturnRequest" ADD COLUMN "faultParty" "FaultParty";

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN "claimStatus" "ClaimStatus",
ADD COLUMN "claimAmount" DECIMAL(12,2),
ADD COLUMN "claimCompensation" DECIMAL(12,2),
ADD COLUMN "claimNote" TEXT,
ADD COLUMN "claimAt" TIMESTAMP(3);
