import crypto from 'node:crypto'
import { prisma } from './prisma.js'
import { normCode } from './orderCode.js'
import { nextShippingStatus, cancelOrderAfterRemoteCancel } from './goshipShipments.js'
import { SHIPPING_TO_ORDER_STATUS, INACTIVE_SHIPMENT } from '../constants/workflow.js'

// Webhook trạng thái do Best Express đẩy tới (tài liệu API Best Express Việt Nam, mục Webhook). Best chỉ hỗ trợ xác thực Bearer (JWT) token:
// token này do mình đặt (BEST_WEBHOOK_TOKEN), gửi kèm URL cho nhân viên sale / bưu cục của Best để họ nhập vào hồ sơ khách hàng.
// local: trạng thái vận đơn của mình; text: nhãn ghi vào lịch sử; cancel: Best báo đã hủy.
const BEST_STATUS = {
  211: { local: 'AWAITING_PICKUP', text: 'Đang đi lấy hàng' },
  203: { text: 'Lấy hàng không thành công' },
  202: { local: 'PICKED_UP', text: 'Lấy hàng thành công' },
  301: { local: 'IN_TRANSIT', text: 'Nhận hàng vào bưu cục nguồn' },
  302: { local: 'IN_TRANSIT', text: 'Xuất hàng đến trung tâm khai thác' },
  303: { local: 'IN_TRANSIT', text: 'Nhận hàng vào trung tâm khai thác' },
  304: { local: 'IN_TRANSIT', text: 'Xuất hàng khỏi trung tâm khai thác' },
  309: { local: 'IN_TRANSIT', text: 'Nhận hàng vào bưu cục phát hàng' },
  601: { local: 'OUT_FOR_DELIVERY', text: 'Xuất hàng để đi giao' },
  604: { local: 'FAILED', text: 'Giao hàng không thành công' },
  666: { local: 'DELIVERED', text: 'Giao hàng thành công' },
  605: { local: 'RETURNING', text: 'Xác nhận chuyển hoàn' },
  606: { text: 'Hủy trả hàng, giao lại' },
  701: { local: 'RETURNING', text: 'Xuất hàng khỏi bưu cục phát để trả về' },
  702: { local: 'RETURNING', text: 'Nhận hàng vào trung tâm khai thác để trả về' },
  703: { local: 'RETURNING', text: 'Xuất hàng khỏi trung tâm khai thác để trả về' },
  704: { local: 'RETURNING', text: 'Nhận hàng vào bưu cục trả hàng' },
  705: { local: 'RETURNING', text: 'Xuất hàng để trả về' },
  707: { local: 'RETURNING', text: 'Trả hàng không thành công' },
  708: { local: 'RETURNED', text: 'Trả hàng thành công' },
  777: { local: 'FAILED', text: 'Thất lạc hàng' },
  1000: { local: 'FAILED', text: 'Hàng hư hỏng' },
  2: { cancel: true, text: 'Đã hủy vận đơn' },
}

export const mapBestStatus = (code) => BEST_STATUS[Number(code)] || {}

// So Bearer token trong header với BEST_WEBHOOK_TOKEN (so sánh thời gian cố định). Chưa đặt token thì từ chối hết: không nhận webhook không xác thực.
export function verifyBestBearer(header, token = process.env.BEST_WEBHOOK_TOKEN) {
  const m = /^Bearer\s+(.+)$/i.exec(String(header || '').trim())
  if (!token || !m) return false
  const a = crypto.createHash('sha256').update(m[1]).digest()
  const b = crypto.createHash('sha256').update(token).digest()
  return crypto.timingSafeEqual(a, b)
}

const str = (v) => (v === undefined || v === null ? '' : String(v).trim())
const inTx = (db, fn) => (typeof db.$transaction === 'function' ? db.$transaction(fn) : fn(db))

// Tìm vận đơn theo mã Best (carrierCode) hoặc mã đơn đối tác (merchant_order_code: mã vận đơn nội bộ hoặc mã đơn hàng của mình).
export async function processBestWebhook(payload, db = prisma) {
  const p = payload && typeof payload === 'object' ? payload : {}
  const codeBest = normCode(p.code_best)
  const merchant = str(p.merchant_order_code)
  if (!codeBest && !merchant) return { handled: false, reason: 'no_reference' }

  const shipment = await db.shipment.findFirst({
    where: { OR: [...(codeBest ? [{ carrierCode: codeBest }] : []), ...(merchant ? [{ trackingId: merchant }, { order: { orderNumber: merchant } }] : [])] },
    include: { order: true },
  })
  if (!shipment) return { handled: false, reason: 'unknown_shipment' }

  const info = mapBestStatus(p.status)
  const label = info.text || (str(p.status) ? `Trạng thái ${str(p.status)}` : '')
  if (!label) return { handled: false, reason: 'no_status' }
  const note = str(p.status_content) || null

  const outcome = await inTx(db, async (tx) => {
    const changes = {}
    let order = null
    if (info.cancel) {
      if (!['DELIVERED', 'RETURNED', ...INACTIVE_SHIPMENT].includes(shipment.status)) changes.status = 'CANCELLED'
      if (shipment.order.status === 'AWAITING_SHIPMENT') order = 'PROCESSING' // để nhân viên tạo lại vận đơn
    } else {
      const next = nextShippingStatus(shipment.status, info.local)
      if (next) {
        changes.status = next
        const mapped = SHIPPING_TO_ORDER_STATUS[next]
        if (mapped && !['CANCELLED', 'RETURNED'].includes(shipment.order.status) && shipment.order.status !== mapped) order = mapped
      }
    }
    if (codeBest && !shipment.carrierCode) changes.carrierCode = codeBest

    // Best gửi lại khi không nhận được phản hồi: không ghi trùng một dòng lịch sử.
    const last = await tx.trackingEvent.findFirst({ where: { shipmentId: shipment.id }, orderBy: { createdAt: 'desc' } })
    const duplicate = last && last.status === label && (last.note || null) === note
    const eventCreate = duplicate ? undefined : { create: { status: label, note } }
    if (Object.keys(changes).length || eventCreate) {
      await tx.shipment.update({ where: { id: shipment.id }, data: { ...changes, ...(eventCreate ? { trackingEvents: eventCreate } : {}) } })
    }
    if (order) {
      await tx.order.update({ where: { id: shipment.orderId }, data: { status: order, statusEvents: { create: { status: order, note: `Cập nhật từ vận chuyển (Best Express): ${label}` } } } })
    }
    if (changes.status || order || !duplicate) {
      await tx.activityLog.create({ data: { entityType: 'shipment', shipmentId: shipment.id, orderId: shipment.orderId, action: `best_${str(p.status) || 'event'}`, actor: 'best', note: `webhook: ${label}` } })
    }
    return { handled: true, status: changes.status || shipment.status, duplicate: Boolean(duplicate), cancelled: Boolean(info.cancel && changes.status === 'CANCELLED') }
  })
  if (outcome.cancelled) await cancelOrderAfterRemoteCancel(shipment.orderId, db)
  return outcome
}

// Route handler. Best cần Result 1 hoặc 2 trong phản hồi; đơn lạ vẫn trả 1 để Best không gửi lại vô ích, lỗi hệ thống thật thì để 500.
export async function bestWebhook(req, res) {
  if (!verifyBestBearer(req.get('authorization'))) {
    console.warn(`[best webhook] sai hoặc thiếu Bearer token (đã đặt BEST_WEBHOOK_TOKEN: ${Boolean(process.env.BEST_WEBHOOK_TOKEN)})`)
    return res.status(401).json({ Result: 0, Message: 'Unauthorized' })
  }
  const result = await processBestWebhook(req.body)
  console.log(`[best webhook] ${req.body?.code_best || req.body?.merchant_order_code || '?'} status=${req.body?.status ?? '?'} -> ${result.handled ? `đã xử lý (${result.status}${result.duplicate ? ', trùng' : ''})` : `bỏ qua (${result.reason})`}`)
  res.status(200).json({ Result: 1, Message: '' })
}
