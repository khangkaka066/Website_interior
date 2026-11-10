// Địa chỉ riêng của sản phẩm: /san-pham/<tên-không-dấu>-<mã>. Ví dụ /san-pham/rem-ore-vai-gam-chong-nang-sp29481006929.
// Tên giúp Google và người đọc hiểu trang nói về gì; mã đứng cuối để tra đúng sản phẩm ngay cả khi tên đổi sau này.
// Địa chỉ cũ (chỉ có mã, hoặc tên cũ + mã) vẫn mở được và được chuyển hướng 308 sang địa chỉ chuẩn (xem san-pham/[id]/page.js).
// Hàm slugify phải GIỐNG HỆT backend/src/lib/productSlug.js (sơ đồ trang và địa chỉ chuẩn dùng chung kết quả).
const MAX_SLUG = 60

export function slugify(input, max = MAX_SLUG) {
  const s = String(input ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (s.length <= max) return s
  // Cắt ở ranh giới từ để không bị cụt giữa chữ.
  const cut = s.slice(0, max)
  const i = cut.lastIndexOf('-')
  return (i > 20 ? cut.slice(0, i) : cut).replace(/-+$/, '')
}

// Đoạn cuối của địa chỉ: "<tên>-<mã>" (hoặc chỉ "<mã>" khi chưa có tên).
export function productParam(p) {
  const slug = slugify(p?.name)
  return slug ? `${slug}-${p.id}` : String(p.id)
}

export const productPath = (p) => `/san-pham/${productParam(p)}`

// Tìm sản phẩm theo đoạn cuối của địa chỉ: khớp đúng mã (địa chỉ cũ) hoặc kết thúc bằng "-<mã>" (lấy mã dài nhất nếu trùng đuôi).
export function findProductByParam(list, param) {
  const key = String(param ?? '')
  if (!key || !Array.isArray(list)) return undefined
  let best
  for (const p of list) {
    if (p.id === key) return p
    if (key.endsWith(`-${p.id}`) && (!best || String(p.id).length > String(best.id).length)) best = p
  }
  return best
}
