---
name: risks-and-open-questions
description: Các mâu thuẫn, lỗi nội dung và câu hỏi chưa có đáp án trong dữ liệu của shop. Đọc TRƯỚC khi viết blog, mô tả sản phẩm hoặc quảng cáo, để không lặp lại thông tin sai hoặc chưa kiểm chứng.
verified: 2026-11-04
status: "Danh sách việc cần chủ shop xác nhận. Agent không được tự giải quyết bằng cách đoán."
---

# Rủi ro và câu hỏi chưa xác nhận

Mức độ: **A** = sai sự thật hoặc rủi ro pháp lý/uy tín, phải xử lý trước khi xuất bản; **B** = mâu thuẫn dữ liệu; **C** = thiếu dữ liệu.

## A. Sai hoặc rủi ro cao

| # | Vấn đề | Bằng chứng | Hành động đề nghị |
|---|---|---|---|
| A1 | Website gọi **rèm cầu vồng** là **"màn sáo lá dọc (vertical blinds)"** | `frontend/app/(shop)/dat-rieng/page.js:5` và `frontend/ui/data/catalogs.js:11`. Catalog ghi rõ *Rèm Cầu Vồng / Zebra Blinds* (vải sọc mờ xen sọc đặc, kéo dây) | Sửa mô tả hai file trên. Trong blog luôn dùng "rèm cầu vồng (Zebra Blinds)". Không dùng "màn sáo lá dọc" |
| A2 | **Xuất xứ vải**: catalog ghi "Hàn Quốc", nhưng trang 12 catalog rèm cuốn là giấy C/O mẫu E (ASEAN-Trung Quốc) cho vải polyester dệt khổ 3,2 m và 3 m | `roller-vh-blinds.md`, `zebra-vh-blinds.md` | Hỏi chủ shop. Chưa xác nhận thì **không nêu xuất xứ** trong bài viết và quảng cáo |
| A3 | Cam kết chưa kiểm chứng trong mô tả sản phẩm: "chống nắng và tia UV 98%", "không phai màu, độ bền lên đến 10 năm", "hoàn tiền 200%", "an toàn với da trẻ nhỏ và người dị ứng" | Mô tả sản phẩm Shopee, ví dụ `sp5449957048` | Không lặp lại các con số này. Cam kết hoàn tiền: chỉ nêu khi có chính sách bằng văn bản. Chính sách đã xác nhận trên web chỉ là "đổi trả khi lỗi do nhà sản xuất" |
| A4 | **Số năm hoạt động** mâu thuẫn: "9 năm kinh nghiệm" (`frontend/ui/data/shop.js`, `shopInfo.stats`) và "hơn 12 năm" (mô tả sản phẩm) | | Chọn một số có thể chứng minh, rồi sửa chỗ còn lại |
| A5 | Tuyên bố **"giá xưởng, làm trực tiếp tại xưởng, không qua trung gian"** (trang Giới thiệu) trong khi catalog VH BLINDS là hàng nhà cung cấp/phân phối và sản phẩm đồng bộ từ Shopee | | Làm rõ sản phẩm nào tự may (rèm may đo) và sản phẩm nào bán lại. Chỉ dùng "giá xưởng" cho nhóm đã tự may |

## B. Mâu thuẫn dữ liệu

| # | Vấn đề | Chi tiết |
|---|---|---|
| B1 | **Tên thương hiệu**: `CLEVINIUM` (tên chuẩn, theo `PRODUCT.md` và commit gần nhất) nhưng còn `CLEVINUM` ở `og:site_name`, `application-name`, tiêu đề/đầu trang `/about`, thẻ "#Clevinum" trên trang chủ; mô tả sản phẩm dùng "RemVietGiaSi - CLEVINIUM"; `PRODUCT.md` còn "CLEVI INTERIOR" | Trong nội dung mới luôn viết **CLEVINIUM**. Slogan: "Rèm Việt Giá Sỉ" |
| B2 | **Hướng dẫn tính độ nhún** không thống nhất giữa các mô tả | Ảnh hướng dẫn của shop (`size-guide/cach-chon-kich-thuoc.jpg`) xác nhận rèm ORE: x1,5 / x2 / x2,5, và kích thước trên shop là của **1 tấm rèm**. Còn lại chưa thống nhất: rèm dán tường x2 / x2,4; chiều cao cửa chính +15 cm so với +10 cm. Xem `guides-from-listings.md` |
| B3 | Mô tả của `sp28833772773` (rèm cuốn PVC) là bản sao của mô tả rèm ORE (khoen đục lỗ, nhún sóng, vải gấm) | Không phù hợp rèm cuốn. Không dùng mô tả này làm nguồn |
| B4 | Đơn vị độ dày trong catalog rèm cầu vồng lẫn cm và mm | Xem `zebra-vh-blinds.md` |
| B5 | Trang `/dat-rieng` (catalog rèm cầu vồng, rèm cuốn) **không có trong sitemap** (kiểm tra 2026-11-04: sitemap có 81 URL, không có `/dat-rieng`) | Thêm vào sitemap để Google biết trang này, nhất là sau khi sửa A1 |

## C. Thiếu dữ liệu

| # | Còn thiếu | Ảnh hưởng |
|---|---|---|
| C1 | **Đơn vị giá** trong catalog rèm cầu vồng (/m²? /bộ?) và đây là giá bán lẻ hay giá nhập | Không công bố giá catalog |
| C2 | **Giá rèm cuốn VH BLINDS**: catalog không in giá | Không báo giá |
| C3 | Trường `sold` của API luôn = 0, `stock` không thực tế (ví dụ 2.353.050) | Không dùng làm "đã bán"/"còn hàng" |
| C4 | Chỉ số uy tín trong `shopInfo.stats` (4,9 sao, 44,1k đánh giá, 86,5k người theo dõi, phản hồi chat 71%) được gõ cứng trong code, nguồn Shopee, không có ngày cập nhật | Nếu trích dẫn, ghi rõ "theo Shopee" và ngày. `PRODUCT.md` yêu cầu chỉ dùng số liệu thật |
| C5 | 11 mục `lh-…` (sơn tường, thạch cao, PU foam, lam sóng, than tre, sàn giả gỗ, bảng hiệu, decal, đèn LED, đồ gỗ) không có giá, mô tả, ảnh thật | Chỉ viết ở mức giới thiệu nhóm dịch vụ, không đưa thông số |
| C6 | Dữ liệu từ khóa tiếng Việt (lượng tìm kiếm, độ khó) | Cần Search Console hoặc Keyword Planner, xem `blog-playbook.md` |
| C7 | Không có ảnh khách hàng thật, chân dung hay logo đối tác (theo `PRODUCT.md`) | Không viết lời chứng thực hay trải nghiệm thực tế |
