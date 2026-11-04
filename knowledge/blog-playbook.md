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

## 6. Quy tắc URL bài viết (tiếng Việt)

Chốt 2026-11-04. Áp dụng cho mọi bài trong `/news`. Bản tiếng Anh (`/en/news/...`) **chưa làm**, chỉ làm khi có nhu cầu thật (xem cuối mục).

**Dạng URL:** `https://clevinium.com/news/<slug>`. Không thêm tiền tố `/vi`, không ngày tháng, không danh mục, không mã số trong đường dẫn.

**Quy tắc đặt `<slug>`:**
1. Chỉ gồm chữ thường **không dấu**, số, và gạch ngang (`-`). Hệ thống chỉ nhận mẫu `^[a-z0-9]+(-[a-z0-9]+)*$`; chữ `đ` viết thành `d`. Ví dụ: `rem-ore` (không `rèm-ore`).
2. Lấy từ **từ khóa chính tiếng Việt** của bài, đặt từ khóa lên đầu: `cach-do-va-tinh-vai-rem-ore`.
3. Độ dài: **tối đa 60 ký tự** (checklist trang duyệt dùng ngưỡng này; giới hạn cứng của hệ thống là 80). Nên gọn, khoảng 3 đến 7 từ.
4. Không đưa vào slug: tên thương hiệu (`clevinium`), năm, ngày, số thứ tự, từ chung chung (`huong-dan-chi-tiet-nhat`), ký tự đặc biệt hay chữ viết hoa.
5. Từ nối ngắn như `va`, `cho` giữ nếu cần cho dễ đọc; bỏ nếu slug bị dài quá 60 ký tự.
6. Một bài một từ khóa chính, nên **một slug không trùng ý** với bài khác (tránh hai bài tranh nhau cùng từ khóa). Kiểm tra danh sách bài trước khi đặt.
7. Tự đặt slug trong form, không để hệ thống tự tạo từ tiêu đề dài. Nếu trùng, hệ thống thêm `-2`, `-3`: đặt lại slug khác thay vì chấp nhận hậu tố này.

**Sau khi đăng:**
- **Không đổi slug.** Đổi slug làm hỏng link đã chia sẻ và thứ hạng. Hiện hệ thống **chưa có chuyển hướng 301** khi sửa slug (xem `risks-and-open-questions.md` mục B6), nên chỉ đổi khi thật cần và phải xử lý chuyển hướng trước.
- Canonical của bài là chính URL đó (đã tự đặt).

**Ví dụ:**

| Tốt | Không tốt | Lý do |
|---|---|---|
| `cach-do-va-tinh-vai-rem-ore` | `Cách-đo-và-tính-vải-rèm-ORE` | Có dấu, chữ hoa |
| `thanh-treo-rem-chon-loai-nao` | `clevinium-thanh-treo-rem-2026-huong-dan-chi-tiet-day-du-nhat` | Có thương hiệu, năm, quá dài |
| `rem-cau-vong-zebra-blinds` | `rem-cau-vong-2` | Hậu tố tự tạo do trùng slug |

**Khi nào làm bản tiếng Anh:** khi có khách hoặc từ khóa tiếng Anh thật (từ Search Console). Cấu trúc dự kiến: `/en/news/<english-slug>`, mỗi ngôn ngữ một slug riêng dịch theo từ khóa tiếng Anh, hai bài trỏ nhau bằng `hreflang`, mặc định `x-default` là bản tiếng Việt.
