// Địa chỉ riêng của sản phẩm: /san-pham/<tên-không-dấu>-<mã> (xem frontend/ui/utils/productUrl.js — hai hàm slugify phải giống hệt nhau).
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
  const cut = s.slice(0, max)
  const i = cut.lastIndexOf('-')
  return (i > 20 ? cut.slice(0, i) : cut).replace(/-+$/, '')
}

export function productParam(p) {
  const slug = slugify(p?.name)
  return slug ? `${slug}-${p.id}` : String(p.id)
}

export const productPath = (p) => `/san-pham/${productParam(p)}`

// Khớp đúng mã (địa chỉ cũ) hoặc kết thúc bằng "-<mã>"; trùng đuôi thì lấy mã dài nhất.
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
