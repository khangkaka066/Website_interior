-- AlterTable
ALTER TABLE "Order" ADD COLUMN "shippingCarrier" TEXT,
ADD COLUMN "packedAt" TIMESTAMP(3),
ADD COLUMN "packedBy" TEXT;

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN "handoverId" TEXT;

-- CreateTable
CREATE TABLE "Handover" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Handover_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Handover_code_key" ON "Handover"("code");

-- CreateIndex
CREATE INDEX "Handover_carrierId_idx" ON "Handover"("carrierId");

-- CreateIndex
CREATE INDEX "Handover_createdAt_idx" ON "Handover"("createdAt");

-- CreateIndex
CREATE INDEX "Shipment_handoverId_idx" ON "Shipment"("handoverId");

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "Handover"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Handover" ADD CONSTRAINT "Handover_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "ShippingCarrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
