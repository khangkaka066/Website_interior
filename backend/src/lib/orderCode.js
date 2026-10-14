import { prisma } from './prisma.js'

// Mã đơn khách và nhân viên nhìn thấy: có mã vận đơn của hãng (đã tạo vận đơn, chưa hủy) thì dùng mã đó, chưa có thì dùng mã đơn ORD-xxxxx.
// ORD-xxxxx vẫn là mã nội bộ cố định: nằm trong nội dung chuyển khoản/PayOS để khớp thanh toán, nên không bỏ được.
export const normCode = (v) => String(v ?? '').trim().toUpperCase()

export const displayCode = (order) => {
  const s = order?.shipment
  return (s && s.status !== 'NOT_CREATED' && s.carrierCode) || order?.orderNumber
}

// Điều kiện tìm đơn bằng mã đơn HOẶC mã vận đơn của hãng.
export const orderCodeWhere = (code) => ({
  OR: [{ orderNumber: code }, { shipment: { carrierCode: code, status: { not: 'NOT_CREATED' } } }],
})

export const findOrderByCode = (code, args = {}, db = prisma) => db.order.findFirst({ ...args, where: orderCodeWhere(normCode(code)) })
