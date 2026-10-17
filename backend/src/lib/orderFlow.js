import { prisma } from './prisma.js'
import { releaseCoupon } from './coupons.js'
import { canTransitionOrder } from '../constants/workflow.js'
import { releaseStock, loadProducts } from './productStore.js'
import { getSettings, COD_METHOD_ID } from './settingsStore.js'
import { sendMail } from './mailer.js'
import { cancelShipmentById } from './goshipShipments.js'
import { classifyDelivery } from './deliveryType.js'
import { orderStatusEmail, NOTIFY_STATUSES } from './emailTemplates.js'

// Vòng đời đơn hàng kiểu Shopee: khách tự hủy / yêu cầu hủy, đã nhận hàng, trả hàng, đánh giá; tự hủy đơn chưa thanh toán.
// Mọi thay đổi trạng thái đơn đều đi qua applyTransition để giữ đúng workflow, trả tồn kho và gửi email như nhau
// dù do nhân viên, khách hay tác vụ chạy nền thực hiện.

export class FlowError extends Error {
  constructor(message, status = 400, code) {
    super(message)
    this.status = status
    this.code = code
  }
}

export const ORDER_INCLUDE = {
  customer: true,
  items: { include: { review: true } },
  statusEvents: { orderBy: { createdAt: 'asc' } },
  shipment: { include: { carrier: true, trackingEvents: { orderBy: { createdAt: 'asc' } } } },
  returnRequest: true,
  activityLogs: { orderBy: { createdAt: 'desc' } },
}

// Các trạng thái "nhân viên còn việc phải làm" (chưa bàn giao cho vận chuyển).
export const OPEN_STATUSES = ['PENDING_CONFIRMATION', 'CONFIRMED', 'PROCESSING', 'AWAITING_SHIPMENT']
const HOUR = 3600 * 1000
const DAY = 24 * HOUR

// Dùng được cả với client thường lẫn client đang nằm trong một transaction (kiểm thử).
const inTx = (db, fn) => (db.$transaction ? db.$transaction(fn) : fn(db))

const logActivity = (db, orderId, action, actor, note) =>
  db.activityLog.create({ data: { entityType: 'order', orderId, action, actor, note } })

const hasActiveShipment = (order) => !!order.shipment && order.shipment.status !== 'NOT_CREATED'

// Hạn nhân viên xử lý đơn (đếm ngược trong admin). null nếu đơn không còn việc hoặc quy tắc tắt.
// Hạn tính theo loại đơn: hỏa tốc và nội thành gấp hơn liên tỉnh. type bỏ trống thì lấy loại đã lưu trên đơn, chưa có thì coi là liên tỉnh.
export function handleDueAt(order, rules, type = order.deliveryType) {
  const hours = type === 'EXPRESS' ? rules?.expressHandleHours : type === 'INTRACITY' ? rules?.intracityHandleHours : rules?.handleHours
  if (!hours || !OPEN_STATUSES.includes(order.status)) return null
  return new Date(new Date(order.createdAt).getTime() + hours * HOUR)
}

// ---------------------------------------------------------------------------------------------------------------
// Đổi trạng thái đơn (workflow chặt). Trả về đơn đã cập nhật (kèm ORDER_INCLUDE).
export async function applyTransition(order, { to, note, actor = 'admin' }, db = prisma) {
  if (!canTransitionOrder(order.status, to)) {
    throw new FlowError(`Không thể chuyển trạng thái từ "${order.status}" sang "${to}".`)
  }

  let released = false
  const updated = await inTx(db, async (tx) => {
    // Điều kiện theo trạng thái cũ: hai người cùng bấm một lúc thì chỉ một thao tác thắng.
    const moved = await tx.order.updateMany({ where: { id: order.id, status: order.status }, data: { status: to } })
    if (moved.count !== 1) throw new FlowError('Đơn hàng vừa được cập nhật bởi người khác, vui lòng tải lại.', 409)
    await tx.orderStatusEvent.create({ data: { orderId: order.id, status: to, note } })
    // Hủy đơn hoặc khách trả hàng: cộng lại tồn kho (chỉ khi đơn này đã trừ kho).
    if ((to === 'CANCELLED' || to === 'RETURNED') && order.stockReserved) {
      const items = await tx.orderItem.findMany({ where: { orderId: order.id } })
      await releaseStock(tx, items.map((i) => ({ productId: i.productId, variant: i.variant, quantity: i.quantity })))
      await tx.order.update({ where: { id: order.id }, data: { stockReserved: false } })
      released = true
    }
    if (to === 'CANCELLED' || to === 'RETURNED') await releaseCoupon(tx, order.id) // trả lại lượt dùng mã giảm giá
    if (to === 'CANCELLED') await tx.order.update({ where: { id: order.id }, data: { cancelRequestedAt: null } })
    await logActivity(tx, order.id, `status_${to.toLowerCase()}`, actor, note)
    return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: ORDER_INCLUDE })
  })

  if (released) await loadProducts() // website thấy số lượng còn lại ngay
  if (NOTIFY_STATUSES.includes(to) && updated.customer?.email) {
    orderStatusEmail(updated, to).then((m) => m && sendMail({ to: updated.customer.email, ...m })).catch(() => {})
  }
  return updated
}

// "Chuẩn bị hàng" (như Shopee): đưa đơn tới "Đang xử lý", tự xác nhận trước nếu đơn còn chờ xác nhận. Đơn chuyển khoản / PayOS phải đã thanh toán
// (hãng lấy hàng đi mà tiền chưa về thì rủi ro). Đơn đã ở Đang xử lý hoặc Chờ giao hàng thì giữ nguyên.
export async function advanceToProcessing(order, actor = 'admin', db = prisma) {
  if (order.paymentMethod !== COD_METHOD_ID && order.paymentStatus !== 'PAID') {
    throw new FlowError('Đơn chưa thanh toán nên chưa chuẩn bị hàng. Hãy xác nhận thanh toán ở mục Thanh toán trước.', 409, 'UNPAID')
  }
  if (order.cancelRequestedAt) throw new FlowError('Khách đang yêu cầu hủy đơn này, hãy phản hồi yêu cầu trước khi chuẩn bị hàng.', 409, 'CANCEL_REQUESTED')
  let cur = order
  if (cur.status === 'PENDING_CONFIRMATION') cur = await applyTransition(cur, { to: 'CONFIRMED', note: 'Xác nhận đơn hàng', actor }, db)
  if (cur.status === 'CONFIRMED') cur = await applyTransition(cur, { to: 'PROCESSING', note: 'Chuẩn bị hàng', actor }, db)
  if (!['PROCESSING', 'AWAITING_SHIPMENT'].includes(cur.status)) {
    throw new FlowError(`Đơn đang ở trạng thái "${cur.status}" nên không chuẩn bị hàng được.`)
  }
  return cur
}

// ---------------------------------------------------------------------------------------------------------------
// Khách hủy đơn: còn "Chờ xác nhận" thì hủy ngay; shop đã xác nhận nhưng chưa giao cho vận chuyển thì gửi yêu cầu để nhân viên duyệt.
export async function customerCancel(order, reason, db = prisma) {
  if (order.status === 'PENDING_CONFIRMATION') {
    const updated = await applyTransition(order, { to: 'CANCELLED', note: `Khách hủy đơn: ${reason}`, actor: 'customer' }, db)
    if (order.paymentStatus === 'PAID') await logActivity(db, order.id, 'cancel_needs_refund', 'system', 'Đơn đã thanh toán bị khách hủy, cần hoàn tiền.')
    return { result: 'cancelled', order: updated }
  }
  if (['CONFIRMED', 'PROCESSING', 'AWAITING_SHIPMENT'].includes(order.status)) {
    if (order.cancelRequestedAt) throw new FlowError('Bạn đã gửi yêu cầu hủy, vui lòng chờ shop phản hồi.', 409)
    await db.order.update({ where: { id: order.id }, data: { cancelRequestedAt: new Date(), cancelRequestReason: reason, cancelRejectedNote: null } })
    await logActivity(db, order.id, 'cancel_requested', 'customer', `Khách yêu cầu hủy đơn: ${reason}`)
    return { result: 'requested' }
  }
  if (order.status === 'SHIPPING') {
    throw new FlowError('Đơn đang được giao nên không thể hủy trên hệ thống. Bạn có thể từ chối nhận hàng khi nhân viên giao hàng liên hệ.')
  }
  throw new FlowError('Đơn hàng này không thể hủy.')
}

export async function approveCancel(order, { note, actor = 'admin' }, db = prisma) {
  if (!order.cancelRequestedAt) throw new FlowError('Đơn này không có yêu cầu hủy nào đang chờ.')
  if (hasActiveShipment(order)) throw new FlowError('Đơn đã có vận đơn: hãy hủy vận đơn trước rồi mới duyệt yêu cầu hủy.', 409)
  const reason = order.cancelRequestReason ? ` (lý do của khách: ${order.cancelRequestReason})` : ''
  return applyTransition(order, { to: 'CANCELLED', note: `${note || 'Đồng ý yêu cầu hủy của khách'}${reason}`, actor }, db)
}

export async function rejectCancel(order, { note, actor = 'admin' }, db = prisma) {
  if (!order.cancelRequestedAt) throw new FlowError('Đơn này không có yêu cầu hủy nào đang chờ.')
  await db.order.update({ where: { id: order.id }, data: { cancelRequestedAt: null, cancelRejectedNote: note } })
  await logActivity(db, order.id, 'cancel_rejected', actor, `Từ chối yêu cầu hủy: ${note}`)
  return db.order.findUniqueOrThrow({ where: { id: order.id }, include: ORDER_INCLUDE })
}

// ---------------------------------------------------------------------------------------------------------------
// Khách xác nhận "Đã nhận hàng" (hoặc hệ thống tự xác nhận sau N ngày).
export async function markReceived(order, { actor = 'customer' } = {}, db = prisma) {
  if (order.status !== 'DELIVERED') throw new FlowError('Chỉ xác nhận đã nhận hàng khi đơn đã được giao.')
  if (order.receivedAt) return { already: true }
  const r = await db.order.updateMany({ where: { id: order.id, receivedAt: null }, data: { receivedAt: new Date() } })
  if (r.count === 1) await logActivity(db, order.id, actor === 'system' ? 'auto_received' : 'received', actor, actor === 'system' ? 'Tự động xác nhận đã nhận hàng' : 'Khách xác nhận đã nhận hàng')
  return { already: r.count !== 1 }
}

// ---------------------------------------------------------------------------------------------------------------
// Trả hàng / hoàn tiền
async function deliveredAt(order, db) {
  const ev = await db.orderStatusEvent.findFirst({ where: { orderId: order.id, status: 'DELIVERED' }, orderBy: { createdAt: 'desc' } })
  return ev?.createdAt || order.updatedAt
}

export async function canRequestReturn(order, rules, db = prisma) {
  if (order.status !== 'DELIVERED' || order.returnRequest || !rules.returnWindowDays) return false
  return Date.now() - new Date(await deliveredAt(order, db)).getTime() <= rules.returnWindowDays * DAY
}

export async function createReturnRequest(order, { reason, note }, rules, db = prisma) {
  if (order.status !== 'DELIVERED') throw new FlowError('Chỉ gửi yêu cầu trả hàng khi đơn đã được giao.')
  if (order.returnRequest) throw new FlowError('Đơn này đã có yêu cầu trả hàng.', 409)
  if (!rules.returnWindowDays) throw new FlowError('Shop hiện không nhận yêu cầu trả hàng qua website, vui lòng liên hệ hotline.')
  if (!(await canRequestReturn(order, rules, db))) throw new FlowError(`Đã quá ${rules.returnWindowDays} ngày kể từ khi nhận hàng nên không gửi được yêu cầu trả hàng.`)
  const rr = await db.returnRequest.create({ data: { orderId: order.id, reason, note: note || null } })
  await logActivity(db, order.id, 'return_requested', 'customer', `Khách yêu cầu trả hàng: ${reason}${note ? ` · ${note}` : ''}`)
  return rr
}

export async function approveReturn(order, { note, actor = 'admin' }, db = prisma) {
  if (order.returnRequest?.status !== 'REQUESTED') throw new FlowError('Đơn này không có yêu cầu trả hàng đang chờ.')
  const updated = await applyTransition(order, { to: 'RETURNED', note: `Đồng ý trả hàng: ${order.returnRequest.reason}`, actor }, db)
  await db.returnRequest.update({ where: { orderId: order.id }, data: { status: 'APPROVED', adminNote: note || null, resolvedAt: new Date() } })
  return db.order.findUniqueOrThrow({ where: { id: updated.id }, include: ORDER_INCLUDE })
}

export async function rejectReturn(order, { note, actor = 'admin' }, db = prisma) {
  if (order.returnRequest?.status !== 'REQUESTED') throw new FlowError('Đơn này không có yêu cầu trả hàng đang chờ.')
  await db.returnRequest.update({ where: { orderId: order.id }, data: { status: 'REJECTED', adminNote: note, resolvedAt: new Date() } })
  await logActivity(db, order.id, 'return_rejected', actor, `Từ chối trả hàng: ${note}`)
  return db.order.findUniqueOrThrow({ where: { id: order.id }, include: ORDER_INCLUDE })
}

// ---------------------------------------------------------------------------------------------------------------
// Đánh giá sản phẩm
const maskName = (name) => String(name || 'Khách').split(/\s+/).filter(Boolean).map((w) => `${w[0]}***`).join(' ')

export async function createReviews(order, entries, db = prisma) {
  if (order.status !== 'DELIVERED') throw new FlowError('Chỉ đánh giá được khi đã nhận hàng.')
  const byId = new Map(order.items.map((i) => [i.id, i]))
  const seen = new Set()
  const rows = entries.map((e) => {
    const item = byId.get(e.orderItemId)
    if (!item) throw new FlowError('Sản phẩm đánh giá không thuộc đơn hàng này.')
    if (!item.productId) throw new FlowError('Sản phẩm này không còn để đánh giá.')
    if (seen.has(item.id)) throw new FlowError('Mỗi sản phẩm chỉ đánh giá một lần.')
    seen.add(item.id)
    if (item.review) throw new FlowError(`Bạn đã đánh giá "${item.name}" rồi.`, 409)
    return { orderItemId: item.id, productId: item.productId, rating: e.rating, comment: e.comment || null, variant: item.variant, authorName: maskName(order.recipientName) }
  })
  try {
    await db.review.createMany({ data: rows })
  } catch (err) {
    if (err?.code === 'P2002') throw new FlowError('Sản phẩm này đã được đánh giá.', 409)
    throw err
  }
  await logActivity(db, order.id, 'reviewed', 'customer', `Khách đánh giá ${rows.length} sản phẩm`)
  return rows.length
}

// Công khai: tổng quan + các đánh giá mới nhất của một sản phẩm (không lộ tên thật, số điện thoại).
export async function productReviews(productId, { take = 30 } = {}, db = prisma) {
  const where = { productId, hidden: false }
  const [agg, groups, items] = await Promise.all([
    db.review.aggregate({ where, _avg: { rating: true }, _count: { _all: true } }),
    db.review.groupBy({ by: ['rating'], where, _count: { _all: true } }),
    db.review.findMany({ where, orderBy: { createdAt: 'desc' }, take, select: { id: true, rating: true, comment: true, authorName: true, variant: true, createdAt: true, reply: true, repliedAt: true } }),
  ])
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const g of groups) distribution[g.rating] = g._count._all
  return { count: agg._count._all, average: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : 0, distribution, items }
}

// Công khai: điểm trung bình + số đánh giá của MỌI sản phẩm (để hiện sao trên thẻ sản phẩm). { [productId]: { average, count } }
export async function reviewSummaries(db = prisma) {
  const groups = await db.review.groupBy({ by: ['productId'], where: { hidden: false }, _avg: { rating: true }, _count: { _all: true } })
  const out = {}
  for (const g of groups) out[g.productId] = { average: Math.round(g._avg.rating * 10) / 10, count: g._count._all }
  return out
}

// Quản trị: danh sách đánh giá (kể cả đã ẩn) có lọc theo sao / trạng thái / từ khóa, kèm số liệu tổng quan.
export async function listReviewsAdmin({ rating, status, q, page = 1, pageSize = 20 } = {}, db = prisma) {
  const and = []
  if (rating >= 1 && rating <= 5) and.push({ rating })
  if (status === 'hidden') and.push({ hidden: true })
  if (status === 'visible') and.push({ hidden: false })
  if (status === 'unanswered') and.push({ hidden: false, reply: null }) // đánh giá đang hiện mà shop chưa trả lời
  const term = String(q || '').trim()
  if (term) {
    and.push({
      OR: [
        { comment: { contains: term, mode: 'insensitive' } },
        { authorName: { contains: term, mode: 'insensitive' } },
        { orderItem: { name: { contains: term, mode: 'insensitive' } } },
        { orderItem: { order: { orderNumber: { contains: term, mode: 'insensitive' } } } },
      ],
    })
  }
  const where = and.length ? { AND: and } : {}
  const take = Math.min(100, Math.max(1, pageSize))
  const [total, items, all, hidden, unanswered] = await Promise.all([
    db.review.count({ where }),
    db.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (Math.max(1, page) - 1) * take,
      take,
      select: { id: true, rating: true, comment: true, authorName: true, variant: true, hidden: true, reply: true, repliedAt: true, createdAt: true, productId: true, orderItem: { select: { name: true, order: { select: { id: true, orderNumber: true } } } } },
    }),
    db.review.aggregate({ _avg: { rating: true }, _count: { _all: true } }),
    db.review.count({ where: { hidden: true } }),
    db.review.count({ where: { hidden: false, reply: null } }),
  ])
  return {
    items: items.map(({ orderItem, ...r }) => ({ ...r, productName: orderItem?.name, order: orderItem?.order })),
    total,
    page: Math.max(1, page),
    pageSize: take,
    stats: { total: all._count._all, hidden, unanswered, average: all._avg.rating ? Math.round(all._avg.rating * 10) / 10 : 0 },
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Tác vụ chạy nền
// Tự hủy đơn chuyển khoản/PayOS quá hạn chưa thanh toán (chưa có vận đơn) và trả lại tồn kho.
// opts.rules / opts.where: ghi đè quy tắc và thu hẹp phạm vi đơn (dùng trong kiểm thử để không đụng đơn thật).
export async function autoCancelUnpaid(db = prisma, now = new Date(), opts = {}) {
  const rules = opts.rules || (await getSettings()).orders
  if (!rules.unpaidCancelHours) return 0
  const cutoff = new Date(now.getTime() - rules.unpaidCancelHours * HOUR)
  const due = await db.order.findMany({
    where: {
      paymentMethod: { not: COD_METHOD_ID },
      paymentStatus: { in: ['AWAITING_PAYMENT', 'FAILED'] },
      status: { in: ['PENDING_CONFIRMATION', 'CONFIRMED', 'PROCESSING'] },
      createdAt: { lt: cutoff },
      OR: [{ shipment: null }, { shipment: { status: 'NOT_CREATED' } }],
      ...(opts.where || {}),
    },
    take: 50,
  })
  let n = 0
  for (const order of due) {
    try {
      await applyTransition(order, { to: 'CANCELLED', note: `Tự động hủy: quá ${rules.unpaidCancelHours} giờ chưa thanh toán`, actor: 'system' }, db)
      n++
    } catch (err) {
      if (!(err instanceof FlowError)) console.warn('[orders] tự hủy đơn', order.orderNumber, 'lỗi:', err.message)
    }
  }
  return n
}

// Tự xác nhận đơn hợp lệ để nhân viên khỏi bấm từng đơn: đơn đã thanh toán (PayOS...), hoặc COD không quá autoConfirmCodMax đồng, địa chỉ có đủ
// tỉnh + quận/huyện, khách không đang xin hủy. Chờ autoConfirmDelayMinutes phút để khách còn kịp hủy ngay. Đơn COD lớn / đáng ngờ vẫn do nhân viên xác nhận.
export async function autoConfirmOrders(db = prisma, now = new Date(), opts = {}) {
  const rules = opts.rules || (await getSettings()).orders
  if (!rules.autoConfirmEnabled) return 0
  const payable = [{ paymentStatus: 'PAID' }]
  if (rules.autoConfirmCodMax > 0) payable.push({ paymentMethod: COD_METHOD_ID, total: { lte: rules.autoConfirmCodMax } })
  const due = await db.order.findMany({
    where: {
      status: 'PENDING_CONFIRMATION',
      cancelRequestedAt: null,
      createdAt: { lt: new Date(now.getTime() - (rules.autoConfirmDelayMinutes || 0) * 60000) },
      district: { not: null },
      OR: payable,
      ...(opts.where || {}),
    },
    take: 50,
  })
  let n = 0
  for (const order of due) {
    if (!order.province?.trim() || !order.district?.trim()) continue
    try {
      await applyTransition(order, { to: 'CONFIRMED', note: 'Tự động xác nhận: đơn hợp lệ', actor: 'system' }, db)
      n++
    } catch (err) {
      if (!(err instanceof FlowError)) console.warn('[orders] tự xác nhận', order.orderNumber, 'lỗi:', err.message)
    }
  }
  return n
}

// Tự đồng ý yêu cầu hủy của khách khi nhân viên không phản hồi sau N giờ (như Shopee). Đơn đã có vận đơn thì hủy vận đơn trước;
// hủy vận đơn không được (ví dụ hãng đã lấy hàng) thì giữ nguyên yêu cầu để nhân viên xử lý và ghi nhật ký một lần.
export async function autoApproveCancels(db = prisma, now = new Date(), opts = {}) {
  const rules = opts.rules || (await getSettings()).orders
  if (!rules.cancelAutoApproveHours) return 0
  const cutoff = new Date(now.getTime() - rules.cancelAutoApproveHours * HOUR)
  const due = await db.order.findMany({
    where: { cancelRequestedAt: { lt: cutoff }, status: { in: ['CONFIRMED', 'PROCESSING', 'AWAITING_SHIPMENT'] }, ...(opts.where || {}) },
    include: ORDER_INCLUDE,
    take: 50,
  })
  let n = 0
  for (const order of due) {
    try {
      if (hasActiveShipment(order)) await cancelShipmentById(order.shipment.id, { actor: 'system', note: 'Tự động hủy vận đơn: khách yêu cầu hủy đơn' }, db)
      const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: ORDER_INCLUDE })
      await approveCancel(fresh, { note: `Tự động đồng ý: shop chưa phản hồi sau ${rules.cancelAutoApproveHours} giờ`, actor: 'system' }, db)
      n++
    } catch (err) {
      const known = err instanceof FlowError || err?.name === 'ShipmentError'
      if (!known) console.warn('[orders] tự đồng ý hủy', order.orderNumber, 'lỗi:', err.message)
      if (!order.activityLogs.some((l) => l.action === 'auto_cancel_blocked')) {
        await logActivity(db, order.id, 'auto_cancel_blocked', 'system', `Không tự hủy được theo yêu cầu của khách: ${err.message}`)
      }
    }
  }
  return n
}

// Điền loại giao hàng cho đơn cũ (tạo trước khi có tính năng này) để bộ lọc theo loại đầy đủ. Mỗi lượt xử lý tối đa 200 đơn.
export async function backfillDeliveryTypes(db = prisma, opts = {}) {
  const settings = opts.settings || (await getSettings())
  const rows = await db.order.findMany({ where: { deliveryType: null, ...(opts.where || {}) }, select: { id: true, province: true, shippingService: true }, take: 200 })
  for (const r of rows) {
    await db.order.updateMany({ where: { id: r.id, deliveryType: null }, data: { deliveryType: classifyDelivery({ province: r.province, service: r.shippingService }, settings) } })
  }
  return rows.length
}

// Tự xác nhận "đã nhận hàng" sau N ngày kể từ khi Đã giao.
export async function autoReceive(db = prisma, now = new Date(), opts = {}) {
  const rules = opts.rules || (await getSettings()).orders
  if (!rules.autoReceiveDays) return 0
  const cutoff = new Date(now.getTime() - rules.autoReceiveDays * DAY)
  const due = await db.order.findMany({
    where: { status: 'DELIVERED', receivedAt: null, statusEvents: { some: { status: 'DELIVERED', createdAt: { lt: cutoff } } }, ...(opts.where || {}) },
    take: 100,
  })
  let n = 0
  for (const order of due) {
    try {
      const { already } = await markReceived(order, { actor: 'system' }, db)
      if (!already) n++
    } catch (err) {
      console.warn('[orders] tự xác nhận nhận hàng', order.orderNumber, 'lỗi:', err.message)
    }
  }
  return n
}

let jobTimer = null
export function startOrderJobs({ intervalMs = Number(process.env.ORDER_JOBS_INTERVAL_MS) || 5 * 60 * 1000 } = {}) {
  if (jobTimer) return
  let running = false
  const run = async () => {
    if (running) return
    running = true
    try {
      const confirmed = await autoConfirmOrders()
      const cancelled = await autoCancelUnpaid()
      const approved = await autoApproveCancels()
      const received = await autoReceive()
      await backfillDeliveryTypes()
      if (confirmed || cancelled || approved || received) console.log(`[orders] tự xác nhận ${confirmed} đơn, tự hủy ${cancelled} đơn chưa thanh toán, tự đồng ý ${approved} yêu cầu hủy, tự xác nhận nhận hàng ${received} đơn`)
    } catch (err) {
      console.warn('[orders] tác vụ nền lỗi:', err.message)
    } finally {
      running = false
    }
  }
  jobTimer = setInterval(run, intervalMs)
  jobTimer.unref()
  setTimeout(run, 30_000).unref() // chạy lần đầu sau khi server khởi động xong
}

