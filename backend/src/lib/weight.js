import { getStorefrontProduct } from './productStore.js'

// Khối lượng tính cước: cộng khối lượng thật của từng sản phẩm (nhập ở form sản phẩm, đơn vị kg) nhân số lượng. Chỉ khi MỌI sản phẩm trong đơn
// đều có khối lượng mới dùng; thiếu một món là dùng cân nặng cố định trong Cài đặt (như trước) để không báo cước thấp hơn thực tế.
export const productWeightGrams = (productId) => getStorefrontProduct(productId)?.weightGrams || 0

export function orderWeightGrams(items, fallback, weightOf = productWeightGrams) {
  if (!items?.length) return fallback
  let total = 0
  for (const it of items) {
    const w = weightOf(it.productId)
    if (!(w > 0)) return fallback
    total += w * (Number(it.quantity) || 1)
  }
  return Math.min(100000, Math.max(100, Math.round(total)))
}
