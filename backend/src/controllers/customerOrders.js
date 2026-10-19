import { getSettings } from '../lib/settingsStore.js'
import { findOrderByCode } from '../lib/orderCode.js'
import { ORDER_INCLUDE, FlowError, customerCancel, markReceived, createReturnRequest, createReviews } from '../lib/orderFlow.js'
import { PUBLIC_ORDER_INCLUDE, customerView, normPhone } from './orders.js'

// Việc khách tự làm với đơn của mình: hủy / yêu cầu hủy, đã nhận hàng, trả hàng, đánh giá.
// Hai cách chứng minh là chủ đơn: đã đăng nhập (đơn thuộc hồ sơ của mình) hoặc không đăng nhập thì cần đúng cả mã đơn lẫn số điện thoại
// (giống trang Tra cứu). Đăng nhập nhưng đơn không thuộc hồ sơ của mình thì cũng đi đường số điện thoại. Sai một trong hai đều trả cùng một thông báo để không dò được mã đơn.
const NOT_FOUND = { error: 'Không tìm thấy đơn hàng với thông tin này.' }

async function resolveOrder(req) {
  const code = req.params.orderNumber ?? req.body?.orderNumber
  if (!code) return null
  const order = await findOrderByCode(code, { include: ORDER_INCLUDE })
  if (!order) return null
  if (req.user?.customerId && order.customerId === req.user.customerId) return order
  // Đang đăng nhập bằng tài khoản khác (hoặc đơn đặt khi chưa đăng nhập): vẫn xác thực được bằng số điện thoại như khách vãng lai.
  const phone = normPhone(req.body?.phone)
  if (phone.length < 8) return null
  return [order.recipientPhone, order.customer?.phone].some((p) => normPhone(p) === phone) ? order : null
}

const act = (run) => async (req, res) => {
  const order = await resolveOrder(req)
  res.set('Cache-Control', 'no-store')
  if (!order) return res.status(404).json(NOT_FOUND)
  try {
    const extra = await run(order, req.body || {})
    const fresh = await findOrderByCode(order.orderNumber, { include: PUBLIC_ORDER_INCLUDE })
    res.json({ ok: true, ...extra, order: await customerView(fresh) })
  } catch (err) {
    if (err instanceof FlowError) return res.status(err.status).json({ error: err.message })
    throw err
  }
}

export const cancelMyOrder = act(async (order, b) => {
  const { result } = await customerCancel(order, b.reason, undefined, b.refund || null)
  return { result }
})

export const receiveMyOrder = act(async (order) => {
  await markReceived(order, { actor: 'customer' })
  return {}
})

export const returnMyOrder = act(async (order, b) => {
  const { orders: rules } = await getSettings()
  await createReturnRequest(order, { reason: b.reason, note: b.note }, rules)
  return {}
})

export const reviewMyOrder = act(async (order, b) => ({ saved: await createReviews(order, b.reviews) }))

