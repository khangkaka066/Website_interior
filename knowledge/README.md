---
name: clevinium-knowledge
description: Chỉ mục kho knowledge của CLEVINIUM cho agent (viết blog SEO, chạy quảng cáo, tư vấn). Đọc file này trước, rồi nạp đúng file cần dùng.
verified: 2026-11-04
---

# Knowledge CLEVINIUM

Kho tri thức cho agent làm việc với website **clevinium.com** (cửa hàng rèm cửa và nội thất, Việt Nam). Mục tiêu hiện tại: viết blog tối ưu SEO và chuẩn bị quảng cáo mà **không bịa thông tin**.

## Bắt đầu từ đây

| Cần làm gì | Nạp file |
|---|---|
| Viết bất kỳ nội dung nào cho shop | `brand.md` rồi `risks-and-open-questions.md` |
| Viết blog SEO | `blog-playbook.md`, `glossary-vi.md` |
| Nói về sản phẩm đang bán trên web | `products/web-catalog.md` (người đọc), `data/products.json` (máy đọc) |
| Nói về rèm cầu vồng (Zebra) | `products/zebra-vh-blinds.md` (người đọc), `data/zebra-vh-blinds.json` (máy đọc) |
| Nói về rèm cuốn VH BLINDS | `products/roller-vh-blinds.md` |
| Hướng dẫn đo, độ nhún, thanh treo, giao hàng | `guides-from-listings.md` |
| Thuật ngữ, link nội bộ, hạt giống chủ đề | `glossary-vi.md` |

Chỉ nạp file cần thiết (mỗi file có `description` ở đầu để quyết định).

## Quy tắc

1. **Không bịa.** Số liệu, tên, tính năng, xuất xứ phải có trong các file này hoặc trong nguồn bên ngoài đã dẫn.
2. Gặp mục đánh dấu `(?)`, `(*)` hoặc nằm trong `risks-and-open-questions.md`: không khẳng định, hỏi chủ shop.
3. Thông tin mâu thuẫn: ưu tiên dữ liệu trực tiếp trên web, rồi catalog, rồi mô tả Shopee.
4. Tên thương hiệu luôn là **CLEVINIUM**.
5. Mỗi file ghi `verified` (ngày kiểm tra) và `source`. Dữ liệu quá 30 ngày thì làm mới trước khi dùng cho quảng cáo hoặc giá.

## Nguồn dữ liệu

| Nguồn | Cách lấy | Ghi chú |
|---|---|---|
| Danh mục web | `GET https://clevinium.com/api/shop/products` (65 sản phẩm) | Làm mới: `curl -s https://clevinium.com/api/shop/products -o /tmp/products.json && python3 -I knowledge/scripts/gen_catalog.py /tmp/products.json knowledge` |
| Catalog rèm cầu vồng | `BLINDS - CATALOGS Cầu Vồng.pdf` (51 trang, ảnh) | Gõ lại từ ảnh, giá và độ cản sáng đối chiếu với lớp chữ của PDF. PDF bị `.gitignore`; ảnh trang nằm ở `frontend/public/catalogs/cau-vong-blinds` |
| Catalog rèm cuốn | `CATALOG RÈM CUỐN VH BLINDS.pdf` (12 trang, ảnh) | Ảnh trang ở `frontend/public/catalogs/vh-blinds-rem-cuon` |
| Thương hiệu và chính sách | `PRODUCT.md`, trang `/about`, `/contact`, `/faq`, `frontend/ui/data/shop.js` | |

## Thiết kế kho này tham khảo từ

- [anthropics/skills](https://github.com/anthropics/skills) (187 nghìn sao, 22 nghìn fork khi kiểm tra ngày 2026-11-04): mỗi tài liệu có phần đầu `name` và `description` để agent chọn đúng file, nội dung chi tiết tách riêng (nạp theo nhu cầu).
- [agentsmd/agents.md](https://github.com/agentsmd/agents.md) (25 nghìn sao): file chỉ mục ngắn ở đầu thư mục, quy tắc cụ thể thay vì lời khuyên chung chung.
- [AnswerDotAI/llms-txt](https://github.com/AnswerDotAI/llms-txt) (2,7 nghìn sao): ý tưởng cung cấp bản tóm tắt markdown cho mô hình. Có thể sinh `/llms.txt` từ kho này sau, nhưng hiện `claude-seo` ghi rằng Google Search bỏ qua `llms.txt`, nên chưa ưu tiên.
- Hai repo xuất hiện ở lượt tìm trước (`Traviseric/best-practices`, `rmsrob/agents-template`) có 0-1 sao nên **không** dùng làm chuẩn.

## Trạng thái

Kho được tạo ngày 2026-11-04. Chưa commit lên git. Repo GitHub của dự án là **công khai**: trước khi commit, kiểm tra các điểm trong `risks-and-open-questions.md` mục A và C1 (giá catalog chưa rõ đơn vị).
