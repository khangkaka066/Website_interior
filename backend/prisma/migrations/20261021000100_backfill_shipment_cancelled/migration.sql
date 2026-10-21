-- Vận đơn đã hủy trước đây được đánh dấu NOT_CREATED: chuyển sang CANCELLED nếu lịch sử có dòng "Đã hủy vận đơn" (Goship báo mã 914 cũng ghi dòng này).
UPDATE "Shipment" s
SET "status" = 'CANCELLED'
WHERE s."status" = 'NOT_CREATED'
  AND EXISTS (SELECT 1 FROM "TrackingEvent" t WHERE t."shipmentId" = s."id" AND t."status" = 'Đã hủy vận đơn');
