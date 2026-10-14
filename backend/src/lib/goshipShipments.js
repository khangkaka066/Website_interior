import { normCode } from './orderCode.js'
import { prisma } from './prisma.js'
import { getSettings, COD_METHOD_ID } from './settingsStore.js'
import { quoteShipping, resolveAddressIds } from './shippingRates.js'
import { createGoshipShipment, cancelGoshipShipment, searchGoshipShipment, goshipConfigured, GoshipError } from './goship.js'
import { SHIPPING_TO_ORDER_STATUS } from '../constants/workflow.js'

// Tạo / hủy vận đơn THẬT qua Goship và đồng bộ trạng thái từ webhook. Mọi hàm đọc/ghi database nhận `db` (mặc định prisma)
// để kiểm thử được bên trong một transaction rồi rollback.
// Không đổi database: mã vận đơn Goship (gcode) được lưu làm Shipment.trackingId, nhà vận chuyển là dòng ShippingCarrier có code "GOSHIP".

export const GOSHIP_CARRIER_CODE = 'GOSHIP'

export class ShipmentError extends Error {
  constructor(message, status = 400, code) {
    super(message)
    this.name = 'ShipmentError'
    this.status = status
    this.code = code
  }
}

const LABEL = {
  NOT_CREATED: 'Đã tạo vận đơn',
  AWAITING_PICKUP: 'Chờ lấy hàng',
  PICKED_UP: 'Đã lấy hàng',
  IN_TRANSIT: 'Đang trung chuyển',
  OUT_FOR_DELIVERY: 'Đang giao',
  DELIVERED: 'Giao thành công',
  FAILED: 'Giao thất bại',
  RETURNING: 'Đang hoàn',
  RETURNED: 'Đã hoàn',
}

// Mã trạng thái Goship (https://doc.goship.io/api/shipment/shipment-status-code) -> trạng thái vận đơn của mình.
// Không có `local`: chỉ ghi nhận vào lịch sử (đối soát, chậm giao, lưu kho...). cancel: Goship báo đã hủy.
const GOSHIP_STATUS = {
  900: { text: 'Đơn mới (chưa gửi sang hãng)' },
  901: { local: 'AWAITING_PICKUP' },
  902: { local: 'AWAITING_PICKUP' },
  903: { local: 'PICKED_UP' },
  904: { local: 'OUT_FOR_DELIVERY' },
  905: { local: 'DELIVERED' },
  906: { local: 'FAILED' },
  907: { local: 'RETURNING' },
  908: { local: 'RETURNED' },
  909: { text: 'Đã đối soát với hãng' },
  910: { text: 'Đã đối soát với khách' },
  911: { text: 'Goship đã trả COD' },
  912: { text: 'Chờ thanh toán COD' },
  913: { local: 'DELIVERED' },
  914: { cancel: true },
  915: { text: 'Chậm lấy/giao hàng' },
  916: { text: 'Giao hàng một phần' },
  917: { local: 'FAILED', text: 'Thất lạc hàng' },
  918: { text: 'Đang lưu kho' },
  919: { local: 'IN_TRANSIT' },
  1000: { text: 'Đơn lỗi' },
}

export const mapGoshipStatus = (code) => GOSHIP_STATUS[Number(code)] || {}

const RANK = { AWAITING_PICKUP: 1, PICKED_UP: 2, IN_TRANSIT: 3, OUT_FOR_DELIVERY: 4, DELIVERED: 5 }

// Trạng thái mới của vận đơn khi Goship báo `target`, hoặc null nếu không nên đổi. Webhook có thể đến trễ, lặp hoặc nhảy bước
// (ví dụ bỏ qua "đang trung chuyển"), nên chỉ cho đi tới, không cho lùi, và vận đơn đã kết thúc hoặc đã hủy thì bỏ qua.
export function nextShippingStatus(current, target) {
  if (!target || target === current) return null
  if (['DELIVERED', 'RETURNED', 'NOT_CREATED'].includes(current)) return null
  if (target === 'FAILED') return current === 'RETURNING' ? null : 'FAILED'
  if (target === 'RETURNING') return 'RETURNING'
  if (target === 'RETURNED') return 'RETURNED'
  if (current === 'RETURNING') return null
  if (current === 'FAILED') return RANK[target] >= RANK.OUT_FOR_DELIVERY ? target : null // giao lại sau khi thất bại
  return RANK[target] > RANK[current] ? target : null
}

const inTx = (db, fn) => (typeof db.$transaction === 'function' ? db.$transaction(fn) : fn(db))
const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const str = (v) => (v === undefined || v === null ? '' : String(v))

// ----------------------------------------------------------------------------------------------------------------
// Tạo vận đơn
// ----------------------------------------------------------------------------------------------------------------

async function loadOrderForShipment(db, orderId) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { shipment: true } })
  if (!order) throw new ShipmentError('Không tìm thấy đơn hàng.', 404)
  return order
}

function assertCreatable(order, settings) {
  const g = settings.shipping.goship
  if (!goshipConfigured() || !g?.enabled) throw new ShipmentError('Goship chưa được bật hoặc chưa có GOSHIP_TOKEN.', 403, 'GOSHIP_OFF')
  if (!g.createShipments) throw new ShipmentError('Chưa cho phép tạo vận đơn thật qua Goship. Bật ở Cài đặt, Vận chuyển.', 403, 'CREATE_OFF')
  const o = g.origin
  if (!(o.province && o.district && o.ward && o.street && o.name && o.phone)) {
    throw new ShipmentError('Thiếu thông tin kho gửi hàng (địa chỉ, tên, số điện thoại người gửi) ở Cài đặt, Vận chuyển.', 422, 'ORIGIN_INCOMPLETE')
  }
  if (!['PROCESSING', 'AWAITING_SHIPMENT'].includes(order.status)) {
    throw new ShipmentError(`Đơn hàng đang ở trạng thái "${order.status}", cần xử lý xong trước khi tạo vận đơn.`, 400, 'ORDER_STATE')
  }
  if (order.shipment && order.shipment.status !== 'NOT_CREATED') throw new ShipmentError('Đơn hàng này đã có vận đơn.', 400, 'HAS_SHIPMENT')
}

// Số tiền thu hộ: đơn COD thu đúng tổng khách phải trả (tiền hàng + phí vận chuyển khách đã trả cho shop), còn lại 0.
const codFor = (order) => (order.paymentMethod === COD_METHOD_ID ? Math.round(Number(order.total)) : 0)

// Hỏi cước cho một đơn hàng cụ thể (để admin chọn hãng).
export async function ratesForOrder(orderId, db = prisma, settingsIn) {
  const order = await loadOrderForShipment(db, orderId)
  const settings = settingsIn || (await getSettings())
  assertCreatable(order, settings)
  const quote = await quoteShipping({
    settings,
    address: { province: order.province, district: order.district, ward: order.ward },
    subtotal: Number(order.subtotal),
    cod: codFor(order),
  })
  if (quote.status === 'incomplete') throw new ShipmentError('Địa chỉ của đơn chưa khớp danh sách tỉnh/quận/phường của Goship. Hãy sửa địa chỉ đơn rồi thử lại.', 422, 'ADDRESS_UNMATCHED')
  if (quote.status !== 'ok') throw new ShipmentError('Không lấy được cước từ Goship, vui lòng thử lại.', 502, 'QUOTE_FAILED')
  return { options: quote.options, weightGrams: settings.shipping.goship.defaultWeightGrams, cod: codFor(order), subtotal: Number(order.subtotal) }
}

// Phần thân gửi Goship (thuần, kiểm thử được).
export function buildShipmentBody({ order, settings, rateId, from, to }) {
  const g = settings.shipping.goship
  return {
    rate: rateId,
    payer: 1, // 1 = shop trả cước cho Goship (khách đã trả phí vận chuyển cho shop trong tổng đơn); 0 = người nhận trả
    order_id: order.orderNumber, // mã đơn của mình: để webhook và tra cứu đối chiếu được
    address_from: { name: g.origin.name, phone: g.origin.phone, street: g.origin.street, city: from.city, district: from.district, ward: from.ward },
    address_to: { name: order.recipientName, phone: order.recipientPhone, street: order.addressLine, city: to.city, district: to.district, ward: to.ward },
    parcel: {
      cod: String(codFor(order)),
      amount: String(Math.round(Number(order.subtotal))),
      weight: String(g.defaultWeightGrams),
      width: '1',
      height: '1',
      length: '1',
      metadata: `Đơn ${order.orderNumber}`,
    },
  }
}

const creating = new Set() // chống bấm đúp: một đơn chỉ được tạo vận đơn một lần tại một thời điểm (backend chạy một tiến trình)

async function ensureGoshipCarrier(db) {
  return db.shippingCarrier.upsert({
    where: { code: GOSHIP_CARRIER_CODE },
    update: {},
    create: { code: GOSHIP_CARRIER_CODE, name: 'Goship', enabled: true, apiStatus: 'connected', serviceTypes: [] },
  })
}

export async function createShipmentForOrder({ orderId, rateId, actor = 'admin', settings: settingsIn }, db = prisma) {
  if (creating.has(orderId)) throw new ShipmentError('Đang tạo vận đơn cho đơn này, vui lòng chờ.', 409, 'IN_PROGRESS')
  creating.add(orderId)
  try {
    const order = await loadOrderForShipment(db, orderId)
    const settings = settingsIn || (await getSettings())
    assertCreatable(order, settings)

    // Hỏi lại cước ngay bây giờ: mã lựa chọn chỉ có hiệu lực trong thời gian ngắn và giá có thể đã đổi.
    const { options } = await ratesForOrder(orderId, db, settings)
    const option = options.find((o) => o.id === rateId)
    if (!option) throw new ShipmentError('Cước vận chuyển đã thay đổi, vui lòng tải lại và chọn lại.', 409, 'RATE_CHANGED')

    const g = settings.shipping.goship
    const from = await resolveAddressIds(g.origin)
    const to = await resolveAddressIds({ province: order.province, district: order.district, ward: order.ward })
    if (!from || !to) throw new ShipmentError('Không đổi được địa chỉ sang mã Goship (kho gửi hoặc địa chỉ nhận không khớp danh sách).', 422, 'ADDRESS_UNMATCHED')

    const body = buildShipmentBody({ order, settings, rateId, from, to })
    let created
    try {
      created = await createGoshipShipment(body)
    } catch (err) {
      if (!(err instanceof GoshipError)) throw err
      // Mất kết nối giữa chừng: Goship có thể đã tạo rồi. Tra theo mã đơn của mình để không tạo trùng.
      if (!err.network) throw new ShipmentError(err.message, 502, 'GOSHIP_REJECTED')
      const found = await searchGoshipShipment(order.orderNumber).catch(() => null)
      if (!found) throw new ShipmentError('Không kết nối được Goship, chưa tạo vận đơn. Vui lòng thử lại.', 502, 'NETWORK')
      created = { id: found.id ?? found.gcode, tracking_number: found.tracking_number ?? found.carrier_code, sorting_code: found.sorting_code, shipment_status: found.status_code ?? found.shipment_status, fee: found.fee, carrier: found.carrier_name ?? found.carrier, carrier_short_name: found.carrier_short_name }
    }

    const gcode = str(created.id)
    const status = Number(created.shipment_status)
    if (!gcode || status === 900 || created.carrier_error) {
      // Goship báo lỗi tạo (HTTP vẫn 200). Dọn đơn nháp nếu có, rồi báo lý do thật cho admin.
      if (gcode) await cancelGoshipShipment(gcode).catch(() => {})
      const reason = typeof created.carrier_error === 'string' ? created.carrier_error : JSON.stringify(created.carrier_error || '')
      throw new ShipmentError(`Hãng vận chuyển từ chối vận đơn${reason ? `: ${reason}` : '.'}`, 422, 'CARRIER_ERROR')
    }

    const carrier = await ensureGoshipCarrier(db)
    const noteBits = [created.carrier ? `${created.carrier}${created.carrier_short_name ? ` (${created.carrier_short_name})` : ''}` : 'Goship', created.tracking_number ? `mã hãng: ${created.tracking_number}` : null].filter(Boolean)
    const note = `Goship · ${noteBits.join(' · ')}`
    const local = mapGoshipStatus(status).local || 'AWAITING_PICKUP'
    const fee = num(created.fee) ?? option.fee
    const data = {
      trackingId: gcode,
      sortingCode: str(created.sorting_code) || null,
      carrierCode: normCode(created.tracking_number) || null, // ghi rõ cả khi rỗng: bản ghi dùng lại của vận đơn đã hủy phải bỏ mã cũ
      carrierId: carrier.id,
      status: local,
      senderName: g.origin.name,
      recipientName: order.recipientName,
      recipientPhone: order.recipientPhone,
      addressLine: order.addressLine,
      ward: order.ward,
      district: order.district,
      province: order.province,
      weightGrams: g.defaultWeightGrams,
      lengthCm: 1,
      widthCm: 1,
      heightCm: 1,
      goodsType: null,
      shippingFee: fee,
      codAmount: codFor(order),
      note,
    }

    return await inTx(db, async (tx) => {
      const eventData = { status: LABEL[local] || local, note: `Đã tạo vận đơn thật qua ${note}` }
      const shipment = order.shipment
        ? await tx.shipment.update({ where: { id: order.shipment.id }, data: { ...data, trackingEvents: { create: eventData } } }) // dùng lại bản ghi của vận đơn đã hủy (mỗi đơn chỉ có một bản ghi)
        : await tx.shipment.create({ data: { ...data, orderId: order.id, trackingEvents: { create: eventData } } })
      if (order.status !== 'AWAITING_SHIPMENT' && order.status !== 'SHIPPING') {
        await tx.order.update({ where: { id: order.id }, data: { status: 'AWAITING_SHIPMENT', statusEvents: { create: { status: 'AWAITING_SHIPMENT', note: 'Đã tạo vận đơn qua Goship' } } } })
      }
      await tx.activityLog.create({ data: { entityType: 'shipment', shipmentId: shipment.id, orderId: order.id, action: 'create_shipment_goship', actor, note: `${note} · cước ${fee}đ` } })
      return tx.shipment.findUniqueOrThrow({ where: { id: shipment.id }, include: { carrier: true, order: { include: { customer: true } }, trackingEvents: { orderBy: { createdAt: 'asc' } } } })
    })
  } finally {
    creating.delete(orderId)
  }
}

// ----------------------------------------------------------------------------------------------------------------
// Hủy vận đơn
// ----------------------------------------------------------------------------------------------------------------

// Vận đơn Goship thì hủy cả bên Goship trước; Goship không hủy được thì KHÔNG đánh dấu hủy ở mình (tránh lệch: bên hãng vẫn chạy).
export async function cancelOnGoship(shipment) {
  if (shipment.carrier?.code !== GOSHIP_CARRIER_CODE) return { cancelledRemote: false }
  if (!goshipConfigured()) throw new ShipmentError('Chưa có GOSHIP_TOKEN nên không hủy được vận đơn bên Goship.', 503, 'GOSHIP_OFF')
  try {
    await cancelGoshipShipment(shipment.trackingId)
    return { cancelledRemote: true }
  } catch (err) {
    if (!(err instanceof GoshipError)) throw err
    if (err.status === 404) return { cancelledRemote: false, missing: true } // Goship không còn thấy vận đơn này: coi như đã hủy
    throw new ShipmentError(`Goship không hủy được vận đơn: ${err.message} (thường do hãng đã lấy hàng). Hãy hủy trên cổng Goship hoặc liên hệ hãng.`, 502, 'GOSHIP_CANCEL_FAILED')
  }
}

// Hủy một vận đơn (cả bên Goship nếu là vận đơn Goship) và đánh dấu "chưa tạo vận đơn". Dùng chung cho nút của nhân viên và tác vụ tự hủy.
export async function cancelShipmentById(shipmentId, { actor = 'admin', note } = {}, db = prisma) {
  const shipment = await db.shipment.findUnique({ where: { id: shipmentId }, include: { carrier: true } })
  if (!shipment) throw new ShipmentError('Không tìm thấy vận đơn.', 404, 'NOT_FOUND')
  if (['DELIVERED', 'RETURNED'].includes(shipment.status)) throw new ShipmentError('Không thể hủy vận đơn đã hoàn tất.', 400, 'FINISHED')

  // Vận đơn Goship: hủy bên Goship trước. Goship không hủy được (ví dụ hãng đã lấy hàng) thì giữ nguyên, không đánh dấu hủy ở mình.
  const remote = await cancelOnGoship(shipment)
  return inTx(db, async (tx) => {
    const s = await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        status: 'NOT_CREATED',
        trackingEvents: { create: { status: 'Đã hủy vận đơn', note: remote.cancelledRemote ? [note, 'Đã hủy bên Goship'].filter(Boolean).join(' · ') : note } },
      },
      include: { carrier: true, order: { include: { customer: true } }, trackingEvents: { orderBy: { createdAt: 'asc' } } },
    })
    await tx.activityLog.create({ data: { entityType: 'shipment', shipmentId: shipment.id, orderId: shipment.orderId, action: 'cancel_shipment', actor, note } })
    return s
  })
}

// ----------------------------------------------------------------------------------------------------------------
// Webhook
// ----------------------------------------------------------------------------------------------------------------

// Webhook Goship -> các trường dùng được.
export function normalizeWebhook(raw) {
  const p = raw && typeof raw === 'object' ? raw : {}
  return {
    gcode: str(p.gcode),
    code: str(p.code),
    orderId: str(p.order_id),
    status: str(p.status),
    statusText: str(p.status_text),
    message: str(p.message),
    description: str(p.description),
    fee: num(p.fee),
    trackingUrl: str(p.tracking_url),
    carrierShortName: str(p.carrier_short_name),
  }
}

// Vận đơn lấy từ API Goship (khi không tin được chữ ký webhook) -> cùng dạng với webhook.
export function fromApiShipment(d, fallback) {
  return {
    ...fallback,
    gcode: str(d.id ?? d.gcode ?? fallback.gcode),
    code: str(d.tracking_number ?? d.carrier_code ?? d.code ?? fallback.code),
    status: str(d.status_code ?? d.shipment_status ?? d.status ?? ''),
    statusText: str(d.status_text ?? d.shipment_status_txt ?? ''),
    message: str(d.message ?? ''),
    description: '',
    fee: num(d.fee) ?? fallback.fee,
    trackingUrl: str(d.tracking_url ?? fallback.trackingUrl),
  }
}

// verified = chữ ký hợp lệ: tin nội dung webhook. Không hợp lệ: bỏ qua nội dung, hỏi lại API Goship và dùng dữ liệu chính thức
// (webhook giả chỉ có thể kích hoạt việc đối chiếu, không đổi được trạng thái).
export async function processGoshipWebhook({ payload, verified }, db = prisma) {
  let p = normalizeWebhook(payload)
  if (!p.gcode && !p.orderId) return { handled: false, reason: 'no_reference' }

  const shipment = await db.shipment.findFirst({
    where: { carrier: { code: GOSHIP_CARRIER_CODE }, OR: [...(p.gcode ? [{ trackingId: p.gcode }] : []), ...(p.orderId ? [{ order: { orderNumber: p.orderId } }] : [])] },
    include: { carrier: true, order: true },
  })
  if (!shipment) return { handled: false, reason: 'unknown_shipment' }

  if (!verified) {
    if (!goshipConfigured()) return { handled: false, reason: 'unverified_no_token' }
    const remote = await searchGoshipShipment(shipment.trackingId).catch(() => null)
    if (!remote) return { handled: false, reason: 'unverified_not_found' }
    p = fromApiShipment(remote, p)
  }

  const info = mapGoshipStatus(p.status)
  const label = p.statusText || info.text || LABEL[info.local] || (p.status ? `Trạng thái ${p.status}` : '')
  if (!label) return { handled: false, reason: 'no_status' }
  const note = [p.message, p.description].filter(Boolean).join(' · ') || null

  return inTx(db, async (tx) => {
    const changes = {}
    let order = null

    if (info.cancel) {
      if (!['DELIVERED', 'RETURNED', 'NOT_CREATED'].includes(shipment.status)) changes.status = 'NOT_CREATED' // đã hủy bên Goship: đưa về như hủy vận đơn
    } else {
      const next = nextShippingStatus(shipment.status, info.local)
      if (next) {
        changes.status = next
        const mapped = SHIPPING_TO_ORDER_STATUS[next]
        if (mapped && !['CANCELLED', 'RETURNED'].includes(shipment.order.status) && shipment.order.status !== mapped) order = mapped
      }
    }
    if (p.fee !== null && p.fee > 0 && Number(shipment.shippingFee) !== p.fee) changes.shippingFee = p.fee // cước thực tế hãng tính
    if (p.code && normCode(p.code) !== shipment.carrierCode) changes.carrierCode = normCode(p.code)
    if (p.code && !String(shipment.note || '').includes(p.code)) {
      changes.note = `${String(shipment.note || 'Goship').replace(/\s·\smã hãng:.*$/, '')} · mã hãng: ${p.code}`
    }

    // Goship gửi lại khi không nhận được 200: không ghi trùng cùng một dòng lịch sử.
    const last = await tx.trackingEvent.findFirst({ where: { shipmentId: shipment.id }, orderBy: { createdAt: 'desc' } })
    const duplicate = last && last.status === label && (last.note || null) === note
    const eventCreate = duplicate ? undefined : { create: { status: label, note } }

    if (Object.keys(changes).length || eventCreate) {
      await tx.shipment.update({ where: { id: shipment.id }, data: { ...changes, ...(eventCreate ? { trackingEvents: eventCreate } : {}) } })
    }
    if (order) {
      await tx.order.update({ where: { id: shipment.orderId }, data: { status: order, statusEvents: { create: { status: order, note: `Cập nhật từ vận chuyển (Goship): ${label}` } } } })
    }
    if (changes.status || order || !duplicate) {
      await tx.activityLog.create({ data: { entityType: 'shipment', shipmentId: shipment.id, orderId: shipment.orderId, action: `goship_${p.status || 'event'}`, actor: 'goship', note: `${verified ? 'webhook' : 'đối chiếu API'}: ${label}` } })
    }
    return { handled: true, status: changes.status || shipment.status, orderStatus: order, duplicate: Boolean(duplicate), verified }
  })
}
