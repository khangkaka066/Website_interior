// Ảnh sản phẩm lấy từ Shopee: bản gốc ~700-900KB (1024px), nhưng thẻ sản phẩm chỉ rộng ~300px. CDN của Shopee cho lấy bản thu nhỏ dạng WebP
// (…@resize_w450_nl.webp ~40KB, nhẹ hơn ~19 lần) nên chỉ xin đúng cỡ cần dùng. Ảnh không phải của Shopee (ảnh tự tải lên...) giữ nguyên.
const SHOPEE_FILE = /^https:\/\/cf\.shopee\.vn\/file\/[\w-]+$/

export function sized(url, width) {
  return url && SHOPEE_FILE.test(url) ? `${url}@resize_w${width}_nl.webp` : url
}

// Cỡ thường dùng: thumb = ảnh nhỏ (giỏ hàng, gợi ý tìm kiếm, ảnh nhỏ trang chi tiết), card = thẻ sản phẩm, large = ảnh lớn (khuyến mãi, ảnh chính trang chi tiết).
export const IMG = { thumb: 150, small: 200, card: 450, large: 800 }
