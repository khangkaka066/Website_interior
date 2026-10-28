// Sản phẩm "Liên hệ báo giá" cho các nhóm chưa bán trực tuyến (vật liệu, bảng hiệu/đèn LED, đồ gỗ).
// Không có giá nên không đặt hàng được (xem priceLine ở controllers/orders.js); khách bấm Liên hệ để được tư vấn.
// Ảnh minh họa lấy từ Pexels (giấy phép Pexels: dùng miễn phí, kể cả thương mại, không bắt buộc ghi nguồn).
const make = (slug, categoryId, type, name, description) => ({
  id: `lh-${slug}`,
  shopeeId: '',
  name,
  price: 0,
  contactOnly: true,
  image: `/images/products/${slug}.webp`,
  images: [`/images/products/${slug}.webp`],
  categoryId,
  type,
  description: `${description}\n\nGiá tùy theo kích thước, chất liệu và số lượng. Vui lòng liên hệ để được tư vấn và báo giá trực tiếp.`,
  sold: 0,
  createdAt: '2026-10-28T00:00:00.000Z',
})

export const contactProducts = [
  make('son-tuong', 'vat-lieu', 'Vật liệu nội thất', 'Sơn tường nội thất', 'Thi công và cung cấp sơn tường nội, ngoại thất, nhiều màu và hiệu ứng hoàn thiện.'),
  make('thach-cao', 'vat-lieu', 'Vật liệu nội thất', 'Trần vách thạch cao', 'Thi công trần, vách ngăn thạch cao phẳng và trần thả, đẹp, bền, cách âm tốt.'),
  make('pu-foam', 'vat-lieu', 'Vật liệu nội thất', 'PU foam trang trí', 'Phào chỉ, tấm ốp PU foam nhẹ, chống ẩm, dễ lắp đặt cho tường và trần.'),
  make('lam-song', 'vat-lieu', 'Vật liệu nội thất', 'Lam sóng ốp tường', 'Tấm lam sóng ốp tường, ốp trần tạo điểm nhấn hiện đại cho phòng khách, quán cà phê, văn phòng.'),
  make('than-tre', 'vat-lieu', 'Vật liệu nội thất', 'Tấm ốp than tre', 'Tấm ốp than tre than hoạt tính, bề mặt đẹp, chống ẩm, thân thiện môi trường.'),
  make('san-gia-go', 'vat-lieu', 'Vật liệu nội thất', 'Sàn giả gỗ', 'Sàn nhựa, sàn giả gỗ vân đẹp, chống nước, lắp đặt nhanh.'),
  make('bang-hieu', 'bang-hieu-den', 'Bảng hiệu & đèn LED', 'Bảng hiệu', 'Thiết kế và thi công bảng hiệu cửa hàng, hộp đèn, chữ nổi theo yêu cầu.'),
  make('decal', 'bang-hieu-den', 'Bảng hiệu & đèn LED', 'Decal dán trang trí', 'In và cắt decal dán kính, dán tường, dán xe với nhiều chất liệu.'),
  make('den-led', 'bang-hieu-den', 'Bảng hiệu & đèn LED', 'Đèn LED trang trí chiếu sáng', 'Đèn LED dây, đèn hắt, đèn trang trí cho nhà ở, cửa hàng và không gian kinh doanh.'),
  make('do-go-gia-dung', 'do-go', 'Đồ gỗ nội thất', 'Đồ gỗ gia dụng', 'Đồ gỗ gia dụng làm từ gỗ tự nhiên: thớt, khay, kệ nhà bếp và các vật dụng hằng ngày.'),
  make('do-go-trang-tri', 'do-go', 'Đồ gỗ nội thất', 'Đồ gỗ trang trí nội thất', 'Kệ, giá treo tường và đồ gỗ trang trí làm theo mẫu hoặc theo yêu cầu.'),
]
