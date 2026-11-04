-- Duyệt bài viết: lưu báo cáo chấm điểm SEO và lý do từ chối (cả hai tùy chọn).
ALTER TABLE "Post" ADD COLUMN "seoReport" JSONB;
ALTER TABLE "Post" ADD COLUMN "rejectReason" TEXT;
