-- AlterTable
ALTER TABLE "Order" ADD COLUMN "recipientLat" DOUBLE PRECISION,
ADD COLUMN "recipientLng" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN "onDemand" BOOLEAN NOT NULL DEFAULT false;
