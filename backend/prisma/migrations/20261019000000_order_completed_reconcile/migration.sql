-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'COMPLETED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "completedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN "actualFee" DECIMAL(12,2),
ADD COLUMN "extraFee" DECIMAL(12,2),
ADD COLUMN "codCollected" DECIMAL(12,2),
ADD COLUMN "reconciledAt" TIMESTAMP(3),
ADD COLUMN "reconcileNote" TEXT;
