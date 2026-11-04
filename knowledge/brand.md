---
name: brand
description: Thông tin thương hiệu CLEVINIUM - tên gọi chuẩn, liên hệ, chính sách, đối tượng khách, nhóm sản phẩm, giọng văn đề nghị. Đọc trước mọi nội dung viết cho shop.
source: PRODUCT.md, website clevinium.com (/about, /contact, /faq), frontend/ui/data/shop.js
verified: 2026-11-04
status: "Thông tin liên hệ và chính sách lấy từ website công khai. Phần Giọng văn là đề xuất rút ra từ nội dung web, chưa được chủ shop duyệt."
---

# CLEVINIUM

## Định danh

- Tên chuẩn: **CLEVINIUM** (viết hoa, có chữ I). Không viết CLEVINUM, Clevinum, CLEVI INTERIOR. Xem `risks-and-open-questions.md` B1.
- Slogan trên web: **Rèm Việt Giá Sỉ**. Mô tả ngắn: rèm cửa chất lượng cao, giá xưởng, giao hàng toàn quốc.
- Tên shop Shopee: `clevi.interior`. Dữ liệu sản phẩm đồng bộ từ shop này.
- Website: https://clevinium.com

## Liên hệ (công khai trên website)

| | |
|---|---|
| Hotline CSKH | 0356 789 749 |
| Email | clevi.interior@gmail.com |
| Địa chỉ | 47 đường Linh Đông, phường Hiệp Bình, TP. Hồ Chí Minh |
| Giờ làm việc | 8:00 - 21:00 hằng ngày |

## Nhóm sản phẩm và dịch vụ

Rèm dán tường và rèm móc RIDO; rèm ORE (đục lỗ); rèm voan lụa; thanh treo rèm và phụ kiện; rèm khác (rèm cuốn PVC, rèm nhà tắm, gối sofa, khăn trải bàn); sơn tường và vật liệu ốp (thạch cao, PU foam, lam sóng, than tre, sàn giả gỗ); bảng hiệu, decal, đèn LED; đồ gỗ nội thất. Trang Giới thiệu còn liệt kê "thiết kế nội thất, ngoại thất hiện đại" và "ứng dụng AI, chuyển đổi số". Danh sách đầy đủ: `products/web-catalog.md`.

Trang **Đặt riêng** (`/dat-rieng`) cho khách xem catalog rèm cầu vồng và rèm cuốn của VH BLINDS và đặt làm theo kích thước và màu: `products/zebra-vh-blinds.md`, `products/roller-vh-blinds.md`.

## Chính sách đã xác nhận (trang FAQ)

- Rèm may theo số đo; giao 2-5 ngày (hàng có sẵn), cộng 2-3 ngày với hàng may đo.
- Đổi trả khi sản phẩm lỗi do nhà sản xuất, kèm ảnh sản phẩm gửi hotline.

Chi tiết và các điểm chưa thống nhất: `guides-from-listings.md`, `risks-and-open-questions.md`.

## Đối tượng khách (theo PRODUCT.md)

Khách mua rèm cửa và nội thất tại Việt Nam, thường cân nhắc kỹ, xem ảnh thật căn phòng, cần đo đạc và báo giá. Quản trị viên và nhân viên shop xử lý đơn, đánh giá, tin nhắn, mã giảm giá.

## Nguyên tắc nội dung (bắt buộc)

1. Tiếng Việt, có dấu.
2. **Không bịa số liệu**: chỉ dùng số đơn, điểm sao, số đánh giá lấy từ dữ liệu thật; ghi nguồn và ngày. Hiện `sold` và `stock` của API không dùng được.
3. **Không bịa lời chứng thực, trải nghiệm khách hàng, chân dung, logo đối tác.** Không có ảnh khách thật trong kho tư liệu.
4. Ảnh sản phẩm là nhân vật chính. Ảnh thật nằm ở `frontend/public/images/curtains`.
5. Không lặp lại cam kết chưa kiểm chứng (UV 98%, bền 10 năm, hoàn tiền 200%): xem `risks-and-open-questions.md` A3.

## Giọng văn (đề xuất, chờ chủ shop duyệt)

- Thân thiện, thực tế, như người trong nghề tư vấn cho gia đình: ngắn gọn, nói thẳng điều khách cần biết (đo thế nào, chọn loại nào, bao nhiêu ngày giao).
- Câu trả lời trước, giải thích sau. Ví dụ: "Rèm phòng ngủ nên chọn loại cản sáng cao, vì..." thay vì mở bài dài.
- Dùng thuật ngữ khách hay gọi (rèm cầu vồng, rèm ORE, rèm dán tường) và giải thích ngắn lần đầu xuất hiện: `glossary-vi.md`.
- Tránh: từ ngữ phóng đại ("tốt nhất", "rẻ nhất", "số 1"), hứa hẹn kết quả, so sánh nêu tên đối thủ.
