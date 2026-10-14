-- CreateTable
CREATE TABLE "QuickReply" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuickReply_pkey" PRIMARY KEY ("id")
);

-- Bộ câu trả lời mẫu ban đầu (sửa/xóa/thêm được trong mục Tin nhắn)
INSERT INTO "QuickReply" ("id", "label", "text", "position", "updatedAt") VALUES
  ('qr_default_1', 'Chào khách', 'Chào {ten}, em có thể hỗ trợ gì cho mình ạ?', 1, CURRENT_TIMESTAMP),
  ('qr_default_2', 'Hỏi nhu cầu', 'Anh/chị cho em biết kích thước cửa, vị trí lắp đặt và màu sắc mong muốn để em tư vấn mẫu phù hợp nhé ạ.', 2, CURRENT_TIMESTAMP),
  ('qr_default_3', 'Xin số điện thoại', 'Anh/chị để lại số điện thoại để bên em gọi tư vấn và báo giá chi tiết nhanh hơn nhé ạ.', 3, CURRENT_TIMESTAMP),
  ('qr_default_4', 'Xin địa chỉ', 'Anh/chị cho em xin địa chỉ nhận hàng để em kiểm tra phí vận chuyển giúp mình nhé ạ.', 4, CURRENT_TIMESTAMP),
  ('qr_default_5', 'Chờ chút', 'Anh/chị vui lòng đợi em ít phút để kiểm tra giúp mình nhé ạ.', 5, CURRENT_TIMESTAMP),
  ('qr_default_6', 'Cảm ơn', 'Cảm ơn anh/chị đã quan tâm. Cần hỗ trợ thêm anh/chị cứ nhắn cho em nhé ạ!', 6, CURRENT_TIMESTAMP);
