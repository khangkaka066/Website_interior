-- CreateEnum
CREATE TYPE "ReturnRequestStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "cancelRequestedAt" TIMESTAMP(3),
ADD COLUMN "cancelRequestReason" TEXT,
ADD COLUMN "cancelRejectedNote" TEXT,
ADD COLUMN "receivedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ReturnRequest" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "status" "ReturnRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "authorName" TEXT NOT NULL,
    "variant" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReturnRequest_orderId_key" ON "ReturnRequest"("orderId");

-- CreateIndex
CREATE INDEX "ReturnRequest_status_idx" ON "ReturnRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Review_orderItemId_key" ON "Review"("orderItemId");

-- CreateIndex
CREATE INDEX "Review_productId_hidden_idx" ON "Review"("productId", "hidden");

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
