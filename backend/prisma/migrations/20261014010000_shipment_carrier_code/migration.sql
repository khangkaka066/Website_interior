-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN "carrierCode" TEXT;

-- CreateIndex
CREATE INDEX "Shipment_carrierCode_idx" ON "Shipment"("carrierCode");

-- Vận đơn Goship cũ: mã hãng đang nằm trong ghi chú ("... · mã hãng: XXXX") -> chuyển sang cột riêng.
UPDATE "Shipment"
SET "carrierCode" = upper(substring("note" from 'mã hãng: ([^ ·]+)'))
WHERE "note" LIKE '%mã hãng: %' AND "status" <> 'NOT_CREATED';
