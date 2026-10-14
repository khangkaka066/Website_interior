-- AlterTable
ALTER TABLE "Order" ADD COLUMN "deliveryType" TEXT,
ADD COLUMN "shippingService" TEXT;

-- CreateIndex
CREATE INDEX "Order_deliveryType_idx" ON "Order"("deliveryType");
