---
name: blog-playbook
description: Quy tắc cho agent khi viết blog SEO cho CLEVINIUM - nguồn được phép dùng, cấu trúc bài, liên kết nội bộ, hạn chế của công cụ (claude-blog, claude-seo) với tiếng Việt, và quy trình duyệt. Đọc trước khi chạy /blog write hoặc viết bài tin tức.
verified: 2026-11-04
status: "Quy trình đề xuất. Chưa có dữ liệu từ khóa tiếng Việt; chưa có bài blog nào trên /news."
---

# Playbook viết blog

## 1. Nguồn sự thật (theo thứ tự ưu tiên)

1. Dữ liệu sản phẩm trực tiếp trên web (`products/web-catalog.md`, `data/products.json`).
2. Catalog nhà cung cấp (`products/zebra-vh-blinds.md`, `products/roller-vh-blinds.md`), đúng như đã ghi, kèm các lưu ý.
3. Hướng dẫn của shop (`guides-from-listings.md`, FAQ).
4. Mô tả Shopee **chỉ để hiểu sản phẩm**, không trích các con số marketing trong đó.

Mọi thông tin khác (kiến thức chung về rèm, ánh sáng, chất liệu) phải có **nguồn bên ngoài đáng tin** được dẫn trong bài, hoặc không đưa vào. Thứ gì nằm trong `risks-and-open-questions.md` thì không viết ra khi chưa được xác nhận.

## 2. Cấu trúc bài (gợi ý)

- Tiêu đề chứa cụm chính, mô tả meta 130-155 ký tự, một H1 duy nhất.
- Đoạn mở trả lời thẳng câu hỏi trong 2-3 câu.
- H2 theo từng ý khách hay hỏi; bảng so sánh khi có số liệu thật.
- Phần hỏi đáp ngắn cuối bài (dùng làm nội dung hữu ích, không kỳ vọng rich result: Google đã ngừng hiển thị FAQ rich result từ 2026-05-07 theo mô tả skill `blog-schema`).
- **3-10 liên kết nội bộ** đến danh mục và sản phẩm liên quan (công cụ chấm điểm trừ nặng khi thiếu). Dùng URL ở `glossary-vi.md`.
- Có ít nhất vài nguồn ngoài đáng tin cho thông tin chung, ghi nguồn trong thân bài.
- Ảnh thật của sản phẩm trong `frontend/public/images/curtains`, có thuộc tính `alt` mô tả.
- Một lời kêu gọi hành động nhẹ: gọi hotline, xem catalog `/dat-rieng`, gửi số đo.

## 3. Không được làm

- Không bịa trải nghiệm ("chúng tôi đã lắp cho hàng nghìn khách"), lời khách hàng, số đơn, số sao. Chỉ số trong `shopInfo.stats` phải ghi "theo Shopee, ngày...".
- Không báo giá catalog VH BLINDS (chưa rõ đơn vị). Giá sản phẩm web chỉ nêu khoảng thấp-cao và nói giá phụ thuộc kích thước.
- Không nêu xuất xứ vải; không gọi rèm cầu vồng là màn sáo lá dọc.
- Không so sánh nêu tên đối thủ; không hứa kết quả xếp hạng.

## 4. Hạn chế của công cụ (đã kiểm thử 2026-11-04)

- `claude-blog` (`analyze_blog.py`) **nhận nhầm tiếng Việt là tiếng Anh** (`language: "en"`). Chỉ số Flesch ra 106,8 (vượt thang 100), nên điểm "Readability" cho bài tiếng Việt không đáng tin. Dùng điểm của nó để kiểm tra cấu trúc, liên kết, nguồn dẫn, schema; **bỏ qua điểm đọc hiểu**.
- Kết quả thử: bài tiếng Việt 40/100, bài tiếng Anh tương đương 48/100; cả hai bị trừ vì thiếu liên kết nội bộ và nguồn dẫn.
- `claude-seo` chặn `localhost` nên chỉ audit được site đã deploy.
- Không công cụ nào có dữ liệu từ khóa tiếng Việt. Cần **Search Console** (sau khi xác minh `clevinium.com` và gửi sitemap) hoặc Keyword Planner trước khi chốt từ khóa chính.

## 5. Quy trình đề xuất

1. Chọn chủ đề từ bảng hạt giống ở `glossary-vi.md`; kiểm tra lượng tìm kiếm thật.
2. Lập brief (`/blog brief`) chỉ dựa vào các file knowledge này và nguồn ngoài đã dẫn.
3. Viết nháp. **Lưu nháp để chủ shop duyệt**, không tự đăng.
4. Chạy `/blog analyze` và `/seo page <url>` sau khi đăng; xem `risks-and-open-questions.md` trước khi duyệt.
5. Cập nhật `verified` ngày trong các file knowledge bạn đã dùng nếu thay đổi nội dung.
6. Bài đăng qua trang quản trị (API `/api/shop/posts`, đường dẫn `/news/<slug>`); thêm URL vào sitemap nếu hệ thống chưa tự thêm.
