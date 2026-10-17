import { prisma } from './prisma.js'

// Mã giảm giá: kiểm tra điều kiện, tính số tiền giảm, ghi / trả lại lượt dùng.
export class CouponError extends Error {}

const money = (n) => Number(n).toLocaleString('vi-VN') + 'đ'
export const normalizeCode = (c) => String(c || '').trim().toUpperCase().replace(/\s+/g, '')

// Số tiền giảm trên tạm tính: cố định thì giảm đúng số tiền; phần trăm thì tối đa maxDiscount. Không bao giờ giảm quá tạm tính.
export function discountFor(coupon, subtotal) {
  let d = coupon.type === 'FIXED' ? coupon.value : Math.floor((subtotal * coupon.value) / 100)
  if (coupon.type === 'PERCENT' && coupon.maxDiscount) d = Math.min(d, coupon.maxDiscount)
  return Math.max(0, Math.min(d, Math.floor(subtotal)))
}

// Trả { coupon, discount } hoặc ném CouponError với lý do hiện cho khách. customerId có thì kiểm tra thêm lượt dùng của riêng khách đó.
export async function checkCoupon(code, subtotal, { customerId, now = new Date() } = {}, db = prisma) {
  const norm = normalizeCode(code)
  const coupon = norm ? await db.coupon.findUnique({ where: { code: norm } }) : null
  if (!coupon || !coupon.active) throw new CouponError('Mã giảm giá không hợp lệ.')
  if (coupon.startsAt && now < coupon.startsAt) throw new CouponError('Mã giảm giá chưa đến thời gian áp dụng.')
  if (coupon.endsAt && now > coupon.endsAt) throw new CouponError('Mã giảm giá đã hết hạn.')
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) throw new CouponError('Mã giảm giá đã hết lượt sử dụng.')
  if (subtotal < coupon.minOrder) throw new CouponError(`Đơn hàng cần từ ${money(coupon.minOrder)} để dùng mã này.`)
  if (customerId && coupon.perCustomerLimit != null) {
    const used = await db.couponRedemption.count({ where: { couponId: coupon.id, customerId } })
    if (used >= coupon.perCustomerLimit) throw new CouponError('Bạn đã dùng hết số lượt của mã giảm giá này.')
  }
  const discount = discountFor(coupon, subtotal)
  if (discount <= 0) throw new CouponError('Mã giảm giá không áp dụng được cho đơn này.')
  return { coupon, discount }
}

// Trong giao dịch tạo đơn: giữ một lượt dùng (kiểm tra lại giới hạn ngay lúc ghi để hai khách cùng dùng lượt cuối thì chỉ một người được).
export async function redeemCoupon(tx, coupon, { orderId, customerId, amount }) {
  const where = coupon.usageLimit != null ? { id: coupon.id, usedCount: { lt: coupon.usageLimit } } : { id: coupon.id }
  const r = await tx.coupon.updateMany({ where, data: { usedCount: { increment: 1 } } })
  if (r.count !== 1) throw new CouponError('Mã giảm giá đã hết lượt sử dụng.')
  if (coupon.perCustomerLimit != null) {
    const used = await tx.couponRedemption.count({ where: { couponId: coupon.id, customerId } })
    if (used >= coupon.perCustomerLimit) throw new CouponError('Bạn đã dùng hết số lượt của mã giảm giá này.')
  }
  await tx.couponRedemption.create({ data: { couponId: coupon.id, orderId, customerId, amount } })
}

// Hủy đơn / trả hàng: trả lại lượt dùng.
export async function releaseCoupon(tx, orderId) {
  const red = await tx.couponRedemption.findUnique({ where: { orderId } })
  if (!red) return
  await tx.couponRedemption.delete({ where: { id: red.id } })
  await tx.coupon.updateMany({ where: { id: red.couponId, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } })
}
