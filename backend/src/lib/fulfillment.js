import { randomInt } from 'node:crypto'
import { prisma } from './prisma.js'
import { findOrderByCode, normCode, displayCode } from './orderCode.js'
import { FlowError, OPEN_STATUSES, handleDueAt } from './orderFlow.js'
import { deliveryTypeOf } from './deliveryType.js'
import { getSettings, COD_METHOD_ID } from './settingsStore.js'
import { sendMail } from './mailer.js'
import { orderHandoverEmail } from './emailTemplates.js'

// Từ lúc nhân viên bấm "Chuẩn bị hàng" tới khi bàn giao cho hãng: quét mã vạch xác nhận đã đóng gói, rồi lập biên bản bàn giao theo hãng.
const HOUR = 3600 * 1000
const VN_OFFSET = 7 * HOUR
const hasActiveShipment = (o) => !!o.shipment && o.shipment.status !== 'NOT_CREATED'
const qtyOf = (items) => items.reduce((n, i) => n + (Number(i.quantity) || 0), 0)

const summary = (o) => ({
  id: o.id,
  orderNumber: o.orderNumber,
  code: displayCode(o),
  recipientName: o.recipientName,
  province: o.province,
  quantity: qtyOf(o.items),
  carrier: o.shipment?.carrier?.name || null,
  packedAt: o.packedAt,
})

// Quét mã vạch trên tem (mã vận đơn của hãng hoặc mã đơn): đơn được đánh dấu "đã đóng gói". Quét lại cùng mã không lỗi, chỉ báo đã quét rồi.
export async function scanPack(rawCode, actor = 'admin', db = prisma) {
  const code = normCode(rawCode)
  if (!code) throw new FlowError('Mã trống.')
  const order = await findOrderByCode(code, { include: { items: true, shipment: { include: { carrier: true } } } }, db)
  if (!order) throw new FlowError(`Không tìm thấy đơn nào có mã ${code}.`, 404, 'NOT_FOUND')
  if (['CANCELLED', 'RETURNED'].includes(order.status)) throw new FlowError(`Đơn ${order.orderNumber} đã bị hủy hoặc trả, không đóng gói.`, 409, 'CANCELLED')
  if (!hasActiveShipment(order)) throw new FlowError(`Đơn ${order.orderNumber} chưa có vận đơn: hãy bấm "Chuẩn bị hàng" trước khi đóng gói.`, 409, 'NO_SHIPMENT')
  if (!['PROCESSING', 'AWAITING_SHIPMENT'].includes(order.status)) throw new FlowError(`Đơn ${order.orderNumber} đã bàn giao hoặc đã giao, không đóng gói lại.`, 409, 'ALREADY_SHIPPED')
  if (order.packedAt) return { already: true, order: summary(order) }
  const r = await db.order.updateMany({ where: { id: order.id, packedAt: null }, data: { packedAt: new Date(), packedBy: actor } })
  if (r.count === 1) await db.activityLog.create({ data: { entityType: 'order', orderId: order.id, action: 'packed', actor, note: 'Đã đóng gói (quét mã vạch)' } })
  return { already: r.count !== 1, order: summary({ ...order, packedAt: order.packedAt || new Date() }) }
}

// Hàng đợi đóng gói: đơn đã có vận đơn mà chưa đóng gói, và đơn đã đóng gói nhưng chưa bàn giao.
export async function packQueue(db = prisma) {
  const base = { status: { in: ['PROCESSING', 'AWAITING_SHIPMENT'] }, shipment: { is: { status: { not: 'NOT_CREATED' }, handoverId: null } } }
  const include = { items: true, shipment: { include: { carrier: true } } }
  const [waiting, packed] = await Promise.all([
    db.order.findMany({ where: { ...base, packedAt: null }, include, orderBy: { createdAt: 'asc' }, take: 300 }),
    db.order.findMany({ where: { ...base, packedAt: { not: null } }, include, orderBy: { packedAt: 'desc' }, take: 300 }),
  ])
  return { waiting: waiting.map(summary), packed: packed.map(summary) }
}

// ---------------------------------------------------------------------------------------------------------------
// Bàn giao cho hãng
const handoverShipmentSelect = {
  id: true,
  trackingId: true,
  carrierCode: true,
  codAmount: true,
  weightGrams: true,
  pickupMethod: true,
  recipientName: true,
  province: true,
  order: { select: { id: true, orderNumber: true, recipientName: true, customer: { select: { email: true } }, items: { select: { quantity: true } } } },
}

const packedAndWaiting = (carrierId) => ({
  status: 'AWAITING_PICKUP',
  handoverId: null,
  ...(carrierId ? { carrierId } : {}),
  order: { is: { packedAt: { not: null }, status: { in: ['PROCESSING', 'AWAITING_SHIPMENT'] } } },
})

// Các kiện đã đóng gói, chưa bàn giao, nhóm theo hãng.
export async function pendingHandovers(db = prisma) {
  const shipments = await db.shipment.findMany({
    where: packedAndWaiting(),
    select: { ...handoverShipmentSelect, carrier: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
    take: 1000,
  })
  const groups = new Map()
  for (const s of shipments) {
    if (!groups.has(s.carrier.id)) groups.set(s.carrier.id, { carrier: s.carrier, shipments: [] })
    groups.get(s.carrier.id).shipments.push(s)
  }
  return [...groups.values()]
}

const stamp = (now) => {
  const v = new Date(now.getTime() + VN_OFFSET)
  return `${String(v.getUTCFullYear()).slice(2)}${String(v.getUTCMonth() + 1).padStart(2, '0')}${String(v.getUTCDate()).padStart(2, '0')}`
}

// Lập biên bản bàn giao cho một hãng: gom các kiện đã đóng gói (hoặc đúng các kiện được chọn), gắn vào biên bản, ghi hành trình và báo khách.
export async function createHandover({ carrierId, shipmentIds, actor = 'admin' }, db = prisma, now = new Date()) {
  const where = { ...packedAndWaiting(carrierId), ...(shipmentIds?.length ? { id: { in: shipmentIds } } : {}) }
  const shipments = await db.shipment.findMany({ where, select: { ...handoverShipmentSelect, carrier: { select: { id: true, name: true } } } })
  if (!shipments.length) throw new FlowError('Không có kiện nào đã đóng gói đang chờ bàn giao cho hãng này.', 409, 'NOTHING')

  const make = async () => {
    const code = `BG-${stamp(now)}-${String(randomInt(1000)).padStart(3, '0')}`
    return db.handover.create({ data: { code, carrierId, createdBy: actor } })
  }
  let handover
  for (let i = 0; ; i++) {
    try {
      handover = await make()
      break
    } catch (err) {
      if (err?.code !== 'P2002' || i >= 4) throw err // trùng mã (rất hiếm): thử mã khác
    }
  }

  // Chỉ gắn những kiện còn đủ điều kiện tại thời điểm này (hai người bấm cùng lúc thì mỗi kiện chỉ vào một biên bản).
  const claimed = []
  for (const s of shipments) {
    const r = await db.shipment.updateMany({ where: { id: s.id, handoverId: null }, data: { handoverId: handover.id } })
    if (r.count !== 1) continue
    claimed.push(s)
    await db.trackingEvent.create({ data: { shipmentId: s.id, status: 'Đã bàn giao cho hãng vận chuyển', note: `Biên bản ${handover.code}` } })
    await db.activityLog.create({ data: { entityType: 'shipment', shipmentId: s.id, orderId: s.order.id, action: 'handover', actor, note: `Bàn giao theo biên bản ${handover.code}` } })
    const email = s.order.customer?.email
    if (email) orderHandoverEmail(s.order, s, s.carrier.name).then((m) => sendMail({ to: email, ...m })).catch(() => {})
  }
  if (!claimed.length) {
    await db.handover.delete({ where: { id: handover.id } })
    throw new FlowError('Các kiện này vừa được bàn giao ở biên bản khác.', 409, 'RACE')
  }
  return { ...handover, carrier: shipments[0].carrier, shipments: claimed }
}

export async function getHandover(id, db = prisma) {
  return db.handover.findUnique({
    where: { id },
    include: { carrier: { select: { id: true, name: true } }, shipments: { select: handoverShipmentSelect, orderBy: { createdAt: 'asc' } } },
  })
}

export async function listHandovers(db = prisma) {
  const rows = await db.handover.findMany({ orderBy: { createdAt: 'desc' }, take: 30, include: { carrier: { select: { name: true } }, _count: { select: { shipments: true } } } })
  return rows.map((h) => ({ id: h.id, code: h.code, carrier: h.carrier.name, count: h._count.shipments, createdBy: h.createdBy, createdAt: h.createdAt }))
}

// ---------------------------------------------------------------------------------------------------------------
// Giờ chốt đơn trong ngày và khối lượng việc
// Mốc "HH:MM" hôm nay theo giờ Việt Nam -> thời điểm tuyệt đối (UTC). Rỗng thì null.
export function cutoffToday(hhmm, now = new Date()) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm || '')
  if (!m) return null
  const vn = new Date(now.getTime() + VN_OFFSET)
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate(), Number(m[1]), Number(m[2])) - VN_OFFSET)
}

export async function workload(db = prisma, now = new Date()) {
  const settings = await getSettings()
  const rules = settings.orders
  const open = await db.order.findMany({
    where: {
      OR: [
        { status: { in: OPEN_STATUSES }, OR: [{ paymentMethod: COD_METHOD_ID }, { paymentStatus: 'PAID' }] },
        { cancelRequestedAt: { not: null } },
        { returnRequest: { status: 'REQUESTED' } },
      ],
    },
    select: { status: true, createdAt: true, deliveryType: true, province: true, shippingService: true, cancelRequestedAt: true, returnRequest: { select: { status: true } } },
    take: 1000,
  })
  let overdue = 0
  for (const o of open) {
    const due = handleDueAt(o, rules, deliveryTypeOf(o, settings))
    if (due && due.getTime() < now.getTime()) overdue++
  }
  const [toConfirm, toPrepare, toPack, toHandover] = await Promise.all([
    db.order.count({ where: { status: 'PENDING_CONFIRMATION', cancelRequestedAt: null } }),
    db.order.count({ where: { status: { in: ['CONFIRMED', 'PROCESSING'] }, OR: [{ paymentMethod: COD_METHOD_ID }, { paymentStatus: 'PAID' }], shipment: null } }),
    db.order.count({ where: { status: { in: ['PROCESSING', 'AWAITING_SHIPMENT'] }, packedAt: null, shipment: { is: { status: { not: 'NOT_CREATED' } } } } }),
    db.shipment.count({ where: packedAndWaiting() }),
  ])
  const cutoff = cutoffToday(rules.pickupCutoff, now)
  return { needsAction: open.length, overdue, toConfirm, toPrepare, toPack, toHandover, cutoffAt: cutoff, cutoffPassed: !!cutoff && cutoff.getTime() < now.getTime() }
}
