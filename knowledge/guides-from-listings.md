---
name: guides-from-listings
description: Hướng dẫn đo, tính độ nhún, chọn thanh treo và giao hàng, trích từ mô tả sản phẩm và FAQ của shop. Dùng làm nguồn cho bài hướng dẫn cách đo/cách chọn rèm.
source: Mô tả sản phẩm sp5449957048, sp27330910471, sp6449488839 qua API; trang /faq, /contact
verified: 2026-11-04
status: "Là hướng dẫn của shop (không phải tiêu chuẩn ngành). Chỗ nào mâu thuẫn đã đánh dấu."
---

# Hướng dẫn đo và chọn (theo shop)

## Rèm ORE (khoen đục lỗ) và rèm dán tường: tính kích thước

**Nguồn chính thức nhất (do shop làm, có sẵn trên web):** hai ảnh `frontend/public/images/size-guide/cach-chon-kich-thuoc.jpg` (độ nhún) và `cach-do-kich-thuoc.jpg` (đo rộng cửa, cao cửa, cao rèm), hiển thị ở nút "Hướng dẫn chọn kích thước" trên trang sản phẩm. Khi viết nội dung và cần ảnh minh họa việc đo/chọn cỡ, **dùng hai ảnh này**, alt lấy từ `ui/pages/ProductDetail.jsx`.

- **Kích thước rộng x cao trên shop là của 1 tấm rèm** (theo ảnh `cach-chon-kich-thuoc`), đo căng phẳng vải, chưa cộng độ nhún sóng. Khi treo, rèm nhún lại còn khoảng **một nửa** chiều rộng ban đầu.
- Ví dụ trong ảnh cho cả ba mức (x1,5 / x2 / x2,5): cửa 1 m chọn 1 tấm, cửa 2 m chọn 2 tấm. Với cửa 2 m, mỗi tấm vẫn rộng bằng mức ví dụ (1,5 / 2 / 2,5 m), tức tổng chiều ngang = hệ số x rộng cửa.
- Rèm may hoàn thiện theo số tấm rộng x cao, đã gắn khoen, tặng kèm dây vén màn, **không gồm thanh treo**.

| Nguồn | Tổng chiều ngang rèm so với chiều rộng cửa |
|---|---|
| Mô tả rèm ORE | x1,5 (nhún nhẹ, tiết kiệm), x2 (nhún dày vừa phải), x2,5 (nhún dày, nhà phố) |
| Mô tả rèm dán tường | x2 (nhún vừa phải), x2,4 (nhún dày dặn), tính theo rộng lọt lòng cửa |

| Chiều cao rèm | Rèm ORE | Rèm dán tường |
|---|---|---|
| Cửa sổ | cao lọt lòng hoặc mép cửa + khoảng 30 cm | cao lọt lòng + khoảng 30 cm |
| Cửa chính | + khoảng **15 cm** | + khoảng **10 cm** |

**Mâu thuẫn** về cửa chính (+15 hay +10 cm) và hệ số nhún: khi viết blog, nêu như **khoảng gợi ý** (ví dụ "cộng thêm 10-15 cm") và cho biết còn tùy kiểu treo, hoặc hỏi chủ shop một con số duy nhất.

## Thanh treo rèm (mô tả `sp6449488839`)

- Hợp kim nhôm sơn tĩnh điện, đi kèm đủ phụ kiện: đầu chụp, pát đỡ, cút cột, ốc vít.
- Thanh **≤ 1,6 m** giao nguyên không ghép nối.
- Thanh lẻ **≥ 1,8 m** là **2 thanh nối**, gắn 3 pát đỡ và đầu nối ở giữa; rèm treo kiểu vén hai bên.
- Số lượng nhiều thanh nguyên: liên hệ shop để giao riêng.
- Các cỡ thanh trên web: 1 m đến 3,4 m (bước 0,2 m). Màu: Trắng, Gỗ, Màu khác.

## Đặt may theo số đo, giao hàng, đổi trả (trang FAQ)

- Rèm may theo kích thước riêng: chọn rộng x cao khi đặt hàng, xưởng may theo số đo.
- Giao hàng: rèm có sẵn **2-5 ngày**; rèm may đo cộng thêm **2-3 ngày** may.
- Đổi trả: hỗ trợ **khi sản phẩm lỗi do nhà sản xuất**, liên hệ hotline kèm ảnh sản phẩm.
- Thanh toán đã biết: COD, chuyển khoản, PayOS (theo `PRODUCT.md`). Footer có biểu tượng VISA, Mastercard, MoMo (chưa xác nhận đã bật hết).
- Vận chuyển: Goship (theo `PRODUCT.md`), giao toàn quốc.
- Có một số sản phẩm ghi "Hỏa tốc HCM - không giao tỉnh" trong tên (ví dụ `sp12675904385`).

## Mô tả chung về rèm vải (lấy từ mô tả sản phẩm, chỉ dùng như quan điểm mở bài)

Ngoài điều chỉnh ánh sáng, rèm vải giữ ấm vào mùa đông, hạn chế nóng vào mùa hè, bụi và tiếng ồn bên ngoài. Đây là mô tả định tính, không kèm số đo.
