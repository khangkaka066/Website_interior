-- AlterTable
ALTER TABLE "Order" ADD COLUMN "refundBankBin" TEXT,
ADD COLUMN "refundBankName" TEXT,
ADD COLUMN "refundAccountNumber" TEXT,
ADD COLUMN "refundAccountName" TEXT,
ADD COLUMN "refundedAt" TIMESTAMP(3);
