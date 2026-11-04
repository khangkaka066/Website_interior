---
name: web-catalog
description: Danh mục 65 sản phẩm đang hiển thị trên clevinium.com (id, URL, giá thấp-cao, tùy chọn màu/kích thước). Sinh tự động từ API công khai.
source: GET https://clevinium.com/api/shop/products
verified: 2026-11-04
---

# Danh mục sản phẩm trên website

- Giá là **VND**, là khoảng thấp–cao giữa các biến thể (màu × kích thước). Giá thực tế phụ thuộc kích thước người mua chọn.
- Trường `sold` của API đều bằng 0 và `stock` không đáng tin: **không dùng làm số liệu bán hàng** (xem `risks-and-open-questions.md`).
- Sản phẩm `sp…` đồng bộ từ Shopee `clevi.interior`. Sản phẩm `lh-…` là mục "liên hệ", chưa có giá.
- Dữ liệu máy đọc: `../data/products.json`. Làm mới: `curl -s https://clevinium.com/api/shop/products -o /tmp/products.json && python3 -I knowledge/scripts/gen_catalog.py /tmp/products.json knowledge`.

## Rèm Dán Tường & RIDO móc (`dan-tuong`, 22 sản phẩm)

| Sản phẩm | Giá (VND) | Màu / kích thước |
|---|---|---|
| [(1 mét) Miếng dán tường mặt bông không keo hoặc mặt gai có keo cho rèm dán](/products/sp28830763252) `sp28830763252` | 18.976 – 47.440 | 2 cỡ |
| [(Hồng phấn ngọt ngào) Rèm cửa phòng ngủ cao cấp dán tường, rèm cửa sổ chống nắng khoen ORE - Chạm Đến Giấc Mơ Ngọt Ngào](/products/sp9201315906) `sp9201315906` | 192.500 – 901.600 | 20 cỡ: Rộng 1m Cao 1m5 … Rộng 2m8 Cao 2m2 |
| [(Nâu đất ấm cúng) Rèm cửa dán tường phòng ngủ cao cấp, rèm cửa sổ chống nắng Cản Sáng Hoàn Hảo, Giấc Ngủ Trọn Vẹn](/products/sp4948268136) `sp4948268136` | 129.850 – 948.192 | 21 cỡ: Rộng 1m Cao 1m5 … Rộng 2m8 Cao 2m2 |
| [Rèm Cửa Sổ Cao Cấp Dán Tường Màu Sắc Phong Phú và Thời Thượng - Che Nắng 95% (5 màu)](/products/sp27330910471) `sp27330910471` | 114.216 – 861.538 | 5 màu: DÁN Tường Xám Đậm, DÁN Tường Nâu Đất, DÁN Tường Xám Trắng, DÁN Tường Xanh Lá, DÁN Tường Vàng Tươi; 20 cỡ: Rộng 1m Cao 1.3m … Rộng 2.8m Cao 2m |
| [Rèm Cửa Sổ Dán Tường Chống Sáng 95% – Màu Sắc Tinh Tế, Phong Cách Hiện Đại (5 màu)](/products/sp3892298380) `sp3892298380` | 114.048 – 756.000 | 5 màu: Dán tường xám bạc, Dán tường xám ghi, Dán tường xanh dương, Dán tường hồng phấn, Dán tường xám đậm; 20 cỡ: Rộng 1m Cao 1.3m … Rộng 2.8m Cao 2m |
| [Rèm cửa sổ Dán Tường Loại 1 giá xưởng, rèm phòng ngủ chống nắng cao cấp](/products/sp3366890841) `sp3366890841` | 163.761 – 806.400 | 8 màu: Dán Bạc Ngọc Trai, Dán Ghi Xám Tro, Dán Xanh Biển Khơi, Dán Vàng Ánh Kim, Dán Xám Đen Huyền Bí, Dán Hồng Nude, Dán Nâu Đất Việt, Dán Xanh Lá Nature; 12 cỡ: Rộng 1m Cao 1m3 … Rộng 2m8 Cao 1m8 |
| [Rèm cửa sổ móc Rido Loại 1, rèm thay đồ, background livestream, vải treo tường trang trí decor phòng](/products/sp5248262061) `sp5248262061` | 99.256 – 780.342 | 8 màu: RIDO Xám bạc, RIDO Xám ghi, RIDO Xanh dương, RIDO Vàng kem, RIDO Xám đậm, RIDO Hồng phấn, RIDO Nâu đất, RIDO Xanh lá; 12 cỡ: Rộng 1m Cao 1.3m … Rộng 2.8m Cao 1.8m |
| [Rèm Dán Cửa Sổ Cao Cấp 2 Lớp Vải Chống Nắng Kèm Voan Trắng (Size Nhỏ Và Vừa) – Sang Trọng Tiện Lợi](/products/sp24043050122) `sp24043050122` | 177.356 – 884.292 | 4 màu: Dán 2 Lớp Xám Ghi, Dán 2 Lớp Vàng Kem, Dán 2 Lớp Xám Bạc, Dán 2 Lớp Xanh Dương; 21 cỡ: Rộng 1m Cao 1.3m … Rộng 2.8m Cao 2m |
| [Rèm dán cửa sổ cao cấp Hai Lớp vải gấm và voan lụa mờ (size vừa đến lớn) – trẻ trung, thanh lịch](/products/sp28980677265) `sp28980677265` | 209.999 – 989.291 | 8 màu: Dán Xám Trắng + Voan, Dán Xám Ghi + Voan, Dán Xanh Biển + Voan, Dán Vàng Tươi + Voan, Dán Xám Đậm + Voan, Dán Hồng Phấn + Voan, Dán Nâu Đất + Voan, Dán Xanh Lá + Voan; 12 cỡ: Rộng 1m Cao 1.5m … Rộng 2.8m Cao 2.2m |
| [Rèm Dán Tường 2 Lớp cao cấp chống nắng tốt, rèm cửa sổ (Size Nhỏ Và Vừa)](/products/sp26730656657) `sp26730656657` | 186.374 – 884.292 | 4 màu: Dán 2 Lớp Đen Chì, Dán 2 Lớp Hồng Nude, Dán 2 Lớp Nâu Trầm, Dán 2 Lớp Xanh Lá; 21 cỡ: Rộng 1m Cao 1.3m … Rộng 2.8m Cao 2m |
| [Rèm Dán Tường Chống Sáng 95% – Rèm cửa sổ đủ màu sắc (8 màu) Tạo Điểm Nhấn Sang Trọng và Tiện Lợi Cho Ngôi Nhà](/products/sp19034822124) `sp19034822124` | 198.068 – 1.033.846 | 8 màu: Dán tường xanh lá, Dán tường xám đậm, Dán tường nâu đất, Dán tường hồng phấn, Dán tường xám bạc, Dán tường xám ghi, Dán tường xanh dương, Dán tường vàng kem; 12 cỡ: Rộng 1m Cao 1.5m … Rộng 2.8m Cao 2.2m |
| [Rèm móc RIDO vải gấm dày cản nắng tốt nhiều màu sắc (5 màu)](/products/sp28482500494) `sp28482500494` | 93.842 – 835.484 | 5 màu: Rido bạc ánh kim, Rido nâu trầm, Rido xám đen, Rido vàng óng ánh, Rido xanh lá cây; 20 cỡ: Rộng 1m Cao 1.3m … Rộng 2.8m Cao 2m |
| [Rèm móc RIDO vải gấm dày dặn chống nắng đủ màu sắc - 8 màu](/products/sp28882500901) `sp28882500901` | 160.831 – 1.002.581 | 8 màu: Rido Xanh Lá, Rido Xám Đậm Tinh Tế, Rido Nâu Đất Ấm Cúng, Rido Hồng Phấn Tươi, Rido Xám Trắng, Rido Xám Ghi Nhạt, Rido Xanh Dương, Rido Vàng Kem; 12 cỡ: Rộng 1m Cao 1.5m … Rộng 2.8m Cao 2.2m |
| [Rèm Voan DÁN TƯỜNG Trơn Mịn hoặc Kẻ Hạt Mưa Cao Cấp, Hoa Lá Lụa Màu Trắng Xám Mẫu Đa Dạng – Phù Hợp Cửa Sổ Và Cửa Đi](/products/sp26331538658) `sp26331538658` | 132.677 – 648.222 | 3 màu: DÁN VOAN TRẮNG TRƠN, DÁN TRẮNG KẺ HẠT CC, DÁN VOAN XÁM CAO CẤP; 20 cỡ: Rộng 1m Cao 1.3m … Rộng 2.8m Cao 2m |
| [Rèm voan trắng lụa tinh khiết che mờ, rèm cửa sổ dán tường Loại 1, background livestream decor phòng](/products/sp3753509017) `sp3753509017` | 100.737 – 465.696 | 13 cỡ: Rộng 1m Cao 1.3m … Rộng 2.8m Cao 1.8m |
| [Rèm Voan Xám lụa họa tiết xước kẻ hạt mưa cao cấp, rèm dán tường cửa sổ phòng ngủ, background livetream](/products/sp3753510180) `sp3753510180` | 82.568 – 665.840 | 13 cỡ: Rộng 1m Cao 1.3m … Rộng 2.8m Cao 1.8m |
| [(Vàng kem nhã nhặn) Rèm cửa khoen ORE cao cấp, rèm cửa sổ dán tường chống nắng decor phòng ngủ - Mềm Mại Đầy Cảm Hứng](/products/sp7853415882) `sp7853415882` | 129.850 – 840.000 | 21 cỡ: Rộng 1m Cao 1m5 … Rộng 2m8 Cao 2m2 |
| [(Xám bạc tinh khiết) Rèm dán tường cửa phòng ngủ cao cấp, rèm cửa sổ ORE chống nắng gắn tường - Tôn Vinh Không Gian Sống](/products/sp6454460979) `sp6454460979` | 155.078 – 1.033.846 | 21 cỡ: Rộng 1m Cao 1m5 … Rộng 2m8 Cao 2m2 |
| [(Xám đậm tinh tế) Rèm cửa phòng ngủ dán tường cao cấp, rèm cửa sổ khoen ORE chống nắng treo tường - Decor phòng ngủ](/products/sp4253420231) `sp4253420231` | 129.850 – 948.192 | 21 cỡ: Rộng 1m Cao 1m5 … Rộng 2m8 Cao 2m2 |
| [(Xám ghi sang trọng) Rèm cửa khoen ORE cao cấp, rèm cửa sổ chống nắng dán tường - Cho Phòng Ngủ Sang Trọng và Tinh Tế](/products/sp5753415187) `sp5753415187` | 129.850 – 840.000 | 21 cỡ: Rộng 1m Cao 1m5 … Rộng 2m8 Cao 2m2 |
| [(Xanh dương dịu mát) Rèm cửa phòng ngủ cao cấp ORE, rèm cửa sổ chống nắng dán tường decor - Cho Tổ Ấm Êm Dịu và Ấm Áp](/products/sp4453420857) `sp4453420857` | 122.500 – 840.000 | 21 cỡ: Rộng 1m Cao 1m5 … Rộng 2m8 Cao 2m2 |
| [(Xanh Lá Thiên Nhiên) Rèm cửa phòng ngủ cao cấp khoen ORE, rèm dán tường cửa sổ chống nắng - Hài Hoà Không Gian Sống](/products/sp27581451624) `sp27581451624` | 155.078 – 808.267 | 20 cỡ: Rộng 1m Cao 1m5 … Rộng 2m8 Cao 2m2 |

## Rèm Ore (`chong-nang`, 9 sản phẩm)

| Sản phẩm | Giá (VND) | Màu / kích thước |
|---|---|---|
| [Rèm cửa chính cao cấp lớn hơn 3m, rèm cửa chống nắng (5 màu) Loại 1](/products/sp28930288769) `sp28930288769` | 391.006 – 1.151.275 | 5 màu: Xám Trắng Sương Mai, Xanh Dương Sóng Trào, Xám Đậm Hoàng Hôn, Hồng Phấn Dịu Dàng, Xanh Lá Tươi Mát; 8 cỡ: Rộng 1.5m Cao 3.1m … Rộng 4m Cao 3.1m |
| [Rèm cửa sổ chống nắng cao cấp, rèm cửa phòng ngủ giá xưởng Loại 1](/products/sp5449957048) `sp5449957048` | 93.986 – 677.337 | 8 màu: Xám bạc tinh khiết, Xám ghi sang trọng, Xanh dương dịu mát, Vàng kem nhã nhặn, Xám đen tinh tế, Hồng phấn ngọt ngào, Xanh lá thiên nhiên, Nâu đất ấm cúng; 12 cỡ: Rộng 1m Cao 1.3m … Rộng 2.8m Cao 1.8m |
| [Rèm cửa sổ chống nắng Loại 1 kích thước tùy chọn nhiều màu, rèm cửa phòng ngủ giá xưởng - Không Gian Sống Trong Tầm Tay](/products/sp9702889612) `sp9702889612` | 98.835 – 840.000 | 4 màu: Xám Đậm Bóng Đêm, Nâu Đất Mộc Mạc, Hồng Phấn Tươi Trẻ, Xanh Lá Thanh Mát; 25 cỡ: Rộng 1m Cao 1m3 … Rộng 2m8 Cao 2m2 |
| [Rèm đục lỗ ore vải gấm dày chống nắng cản sáng 95% (8 màu) nhiều kích thước](/products/sp29481006929) `sp29481006929` | 191.263 – 1.036.000 | 8 màu: Xanh lá, Xám đậm tinh tế, Nâu đất ấm cúng, Hồng phấn ngọt ngào, Xám bạc tinh khiết, Xám ghi sang trọng, Xanh dương, Vàng kem nhã nhặn; 12 cỡ: Rộng 1m Cao 1.5m … Rộng 2.8m Cao 2.2m |
| [Rèm đục lỗ ore vải gấm dày chống nắng cản sáng 95% sang trọng (5 màu)](/products/sp29381003635) `sp29381003635` | 93.240 – 833.980 | 5 màu: Xám trắng, Xanh dương, Hồng phấn, Ghi nhạt, Xám đen; 20 cỡ: Rộng 1m Cao 1.3m … Rộng 2.8m Cao 2m |
| [Rèm đục lỗ ore vải gấm dày chống nắng tốt (xám bạc, nâu đất, xám đen, vàng tươi, xanh lá) - 5 màu](/products/sp28130935029) `sp28130935029` | 98.835 – 833.980 | 5 màu: Xám bạc, Nâu đất, Xám đen, Vàng tươi, Xanh lá; 20 cỡ: Rộng 1m Cao 1.3m … Rộng 2.8m Cao 2m |
| [Rèm Khoen ORE Cửa Sổ Cao Cấp 2 Lớp Gấm Chống Nắng Và Voan Lụa (Size Nhỏ Và Vừa) – Xu Hướng, Tiện Nghi](/products/sp27531817769) `sp27531817769` | 123.737 – 982.886 | 4 màu: ORE 2 Lớp Xám Ghi, ORE 2 Lớp Vàng Kem, ORE 2 Lớp Xám Bạc, ORE 2 Lớp Xanh Dương; 21 cỡ: Rộng 1m Cao 1.3m … Rộng 2.8m Cao 2m |
| [Rèm khoen ORE Hai Lớp cửa sổ chống nắng cao cấp vải gấm kèm voan trắng (size vừa đến lớn) - tối giản, hiện đại](/products/sp26431672481) `sp26431672481` | 146.511 – 1.085.538 | 8 màu: ORE Xám Bạc + Voan, ORE Xám Ghi + Voan, ORE Xanh Lá + Voan, ORE Vàng Kem + Voan, ORE Xám Đậm + Voan, ORE Nâu Đất + Voan, ORE Hồng Phấn + Voan, ORE Xanh Biển + Voan; 12 cỡ: Rộng 1m Cao 1.5m … Rộng 2.8m Cao 2.2m |
| [Rèm ORE 2 Lớp cao cấp chống nắng tốt, rèm cửa sổ (Size Nhỏ Và Vừa)](/products/sp28981676650) `sp28981676650` | 123.737 – 893.538 | 4 màu: ORE 2 Lớp Xám Đậm, ORE 2 Lớp Hồng Phấn, ORE 2 Lớp Nâu Đất, ORE 2 Lớp Xanh Lá; 21 cỡ: Rộng 1m Cao 1.3m … Rộng 2.8m Cao 2m |

## Rèm Voan Lụa (`voan-lua`, 1 sản phẩm)

| Sản phẩm | Giá (VND) | Màu / kích thước |
|---|---|---|
| [Rèm spa ngăn phòng Loại 1 size lớn hơn 3m, rèm voan trắng xám đa dạng đủ loại giá xưởng](/products/sp3767490504) `sp3767490504` | 343.885 – 1.730.329 | 8 cỡ: Rộng 2.5m Cao 2.7m … Rộng 4.2m Cao 3m |

## Thanh Treo Rèm (`thanh-treo`, 17 sản phẩm)

| Sản phẩm | Giá (VND) | Màu / kích thước |
|---|---|---|
| [(1 cái) Bát đôi thanh treo rèm hai lớp, giá đỡ đôi, trụ đỡ đôi - phụ kiện rèm cửa](/products/sp8660600611) `sp8660600611` | 59.294 | 3 màu: Trắng, Gỗ, Màu Khác |
| [(1 cái) Đầu bịt chụp thanh treo rèm - phụ kiện rèm cửa](/products/sp7849488613) `sp7849488613` | 21.248 – 35.412 | 3 màu: Trắng, Gỗ, Màu Khác |
| [(1 Cái) Giá Đỡ Thanh Treo Gỗ Thông Tự Nhiên Cứng Cáp - Phong Cách Vintage](/products/sp40359598136) `sp40359598136` | 71.029 | — |
| [(1 cái) Giá đỡ thanh treo rèm Keo 3M DÁN bề mặt gỗ, kim loại, gạch, kính tiện lợi - phụ kiện rèm cửa](/products/sp40014001633) `sp40014001633` | 29.933 – 49.889 | 3 cỡ: Gỗ … Trắng |
| [(1 cái) Pát đỡ thanh treo rèm các loại, giá đỡ, trụ đỡ, đầu nối - phụ kiện rèm cửa đa dạng](/products/sp4949489351) `sp4949489351` | 20.654 – 36.235 | 3 cỡ: Gỗ … Trắng |
| [(10 cái) Khoen móc treo rèm, bi trượt đủ loại gắn thanh - phụ kiện rèm cửa các loại](/products/sp5949484640) `sp5949484640` | 21.141 – 35.412 | — |
| [Bộ thanh treo rèm dài 1.8m - 1.9m nguyên không cắt đầy đủ phụ kiện ốc vít, pát đỡ, đầu chụp, cút cột](/products/sp29171438305) `sp29171438305` | 115.180 – 193.488 | 2 cỡ |
| [Dây cột vén rèm nhiều màu sắc](/products/sp27030771713) `sp27030771713` | 13.646 – 31.356 | 11 màu |
| [(Hoả Tốc HCM - Ko Giao Tỉnh) Thanh treo rèm cửa Loại 1 đầy đủ giá đỡ, đầu bịt, núm cột, vít ốc](/products/sp12675904385) `sp12675904385` | 106.977 – 542.868 | 3 màu: Trắng, Gỗ, Màu Khác; 13 cỡ: 1m … 3m4 |
| [Pát đỡ chữ T gắn 1 đầu tường dành cho thanh spa](/products/sp25844075598) `sp25844075598` | 133.051 | — |
| [Thanh ray trượt DÁN TRẦN bề mặt kim loại, gạch, nhôm kính, treo rèm cửa đầy đủ phụ kiện keo dán, pát đỡ, bi trượt](/products/sp42213874535) `sp42213874535` | 177.807 – 591.537 | 12 cỡ: 1m … 3.4m |
| [Thanh ray trượt treo rèm cửa đầy đủ phụ kiện pát đỡ, bộ bi trượt](/products/sp5466604858) `sp5466604858` | 222.147 – 755.300 | 12 cỡ: 1m … 3.4m |
| [Thanh treo đa năng chỉnh từng nấc cao cấp không khoan tường, dễ sử dụng, dễ dàng điều chỉnh](/products/sp26681675290) `sp26681675290` | 316.060 – 608.825 | 2 màu: Trắng, Đen; 5 cỡ: 1.1M - 1.6M … 3.1M - 3.6M |
| [Thanh treo không khoan đa năng kéo dài, thanh treo rèm cửa sổ, giá treo đồ quần áo, ngăn vách phòng](/products/sp9501313919) `sp9501313919` | 250.000 – 270.000 | 2 cỡ |
| [Thanh treo rèm cao cấp giá xưởng đầy đủ phụ kiện ốc vít, pát đỡ, đầu chụp, cút cột](/products/sp6449488839) `sp6449488839` | 128.373 – 542.868 | 3 màu: Trắng, Gỗ, Màu Khác; 13 cỡ: 1m … 3.4m |
| [Thanh treo rèm Keo 3M DÁN KHUNG CỬA cao cấp bề mặt kim loại, gạch, nhôm kính giá xưởng gồm pát đỡ, đầu chụp, cút cột](/products/sp26690157418) `sp26690157418` | 105.337 – 518.824 | 5 màu: TRẮNG DÁN KHUNG CỬA, GỖ DÁN KHUNG CỬA, TRẮNG DÁN TRẦN, GỖ DÁN TRẦN, Màu Khác; 13 cỡ: 1m … 3.4m |
| [(1 cái) Núm cút cột dây vén màn rèm - phụ kiện rèm cửa](/products/sp5149485576) `sp5149485576` | 9.514 – 15.856 | — |

## Rèm Khác (`rem-khac`, 5 sản phẩm)

| Sản phẩm | Giá (VND) | Màu / kích thước |
|---|---|---|
| [Gối tựa sofa vải gấm mềm mại 450x450 nhiều màu sắc](/products/sp24546468731) `sp24546468731` | 125.442 – 220.074 | 8 màu: Xám bạc tinh khiết, Xám ghi sang trọng, Xám đậm tinh tế, Xanh dương dịu mát, Hồng phấn ngọt ngào, Nâu đất ấm cúng, Xanh lá thiên nhiên, Vàng kem nhã nhặn |
| [Rèm cửa chính Loại 1 size lớn cao 3.1m, rèm cửa phòng ngủ chống nắng cao cấp giá xưởng](/products/sp7347161965) `sp7347161965` | 391.006 – 2.093.226 | 8 màu: Xám bạc tinh khiết, Xám ghi sang trọng, Xanh dương dịu mát, Vàng kem nhã nhặn, Xám đậm tinh tế, Nâu đất ấm cúng, Hồng phấn ngọt ngào, Xanh lá thiên nhiên; 8 cỡ: Rộng 1.5m Cao 3.1m … Rộng 4m Cao 3.1m |
| [Rèm cuốn văn phòng vải PVC chống nắng , chống nước tiện lợi dễ dàng sử dụng](/products/sp28833772773) `sp28833772773` | 167.714 – 443.548 | 1 màu: Màu Xám; 5 cỡ: Rộng 0.60m Cao 1.6m … Rộng 1.5m Cao 1.6m |
| [Rèm nhà tắm, rèm ngăn phòng tắm PVC chống nước](/products/sp25494168645) `sp25494168645` | 88.709 – 120.967 | 2 màu: Trắng Họa Tiết, Xám Họa Tiết; 2 cỡ |
| [Tấm khăn vải trải bàn dày dặn DECOR sang trọng, tinh tế](/products/sp27931819619) `sp27931819619` | 90.000 – 174.461 | 8 màu: Xám bạc tinh khiết, Xám ghi sang trọng, Xám đậm tinh tế, Xanh dương dịu mát, Hồng phấn ngọt ngào, Nâu đất ấm cúng, Xanh lá, Vàng kem nhã nhặn; 4 cỡ: Rộng 1m Dài 1.3m … Rộng 1m4 Dài 1.8m |

## Sơn tường & vật liệu ốp (`vat-lieu`, 6 sản phẩm)

| Sản phẩm | Giá (VND) | Màu / kích thước |
|---|---|---|
| [Sơn tường nội thất](/products/lh-son-tuong) `lh-son-tuong` | — | — |
| [Trần vách thạch cao](/products/lh-thach-cao) `lh-thach-cao` | — | — |
| [PU foam trang trí](/products/lh-pu-foam) `lh-pu-foam` | — | — |
| [Lam sóng ốp tường](/products/lh-lam-song) `lh-lam-song` | — | — |
| [Tấm ốp than tre](/products/lh-than-tre) `lh-than-tre` | — | — |
| [Sàn giả gỗ](/products/lh-san-gia-go) `lh-san-gia-go` | — | — |

## Bảng hiệu, decal & đèn LED (`bang-hieu-den`, 3 sản phẩm)

| Sản phẩm | Giá (VND) | Màu / kích thước |
|---|---|---|
| [Bảng hiệu](/products/lh-bang-hieu) `lh-bang-hieu` | — | — |
| [Decal dán trang trí](/products/lh-decal) `lh-decal` | — | — |
| [Đèn LED trang trí chiếu sáng](/products/lh-den-led) `lh-den-led` | — | — |

## Đồ gỗ nội thất (`do-go`, 2 sản phẩm)

| Sản phẩm | Giá (VND) | Màu / kích thước |
|---|---|---|
| [Đồ gỗ gia dụng](/products/lh-do-go-gia-dung) `lh-do-go-gia-dung` | — | — |
| [Đồ gỗ trang trí nội thất](/products/lh-do-go-trang-tri) `lh-do-go-trang-tri` | — | — |
