import { normCode } from './orderCode.js'
import { orderWeightGrams } from './weight.js'
import { prisma } from './prisma.js'
import { getSettings, COD_METHOD_ID } from './settingsStore.js'
import { quoteShipping, resolveAddressIds } from './shippingRates.js'
import { createGoshipShipment, cancelGoshipShipment, searchGoshipShipment, goshipConfigured, GoshipError, requestOndemandRates, createOndemandShipment, cancelOndemandShipment, getOndemandShipment } from './goship.js'
import { geocodeAddress } from './geocode.js'
import { toExpressOption, buildOndemandRatesBody, buildOndemandShipmentBody, mapOndemandStatus, fromApiOndemand } from './ondemand.js'
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
  914: { cancel: true, text: 'Đã hủy vận đơn' },
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
  const order = await db.order.findUnique({ where: { id: orderId }, include: { shipment: true, items: { select: { productId: true, quantity: true } } } })
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

// Khối lượng tính cước của đơn: tổng khối lượng thật của sản phẩm nếu đủ dữ liệu, không thì cân nặng cố định trong Cài đặt.
export const weightFor = (order, settings) => orderWeightGrams(order.items, settings.shipping.goship.defaultWeightGrams)

// Điểm giao của đơn hỏa tốc. Thứ tự: tọa độ nhân viên nhập tay > tọa độ đã lưu (đã xác thực) > tự tra từ địa chỉ.
// level: 'manual' | 'saved' | 'address' (tra được tới số nhà) | 'ward' | 'district' (chỉ tới phường / quận: KHÔNG đủ chính xác để điều shipper tự động).
async function resolveDrop(order, db, override, persist = true) {
  if (override && Number.isFinite(override.lat) && Number.isFinite(override.lng)) {
    // Xem trước cước với tọa độ nhập tay thì chưa ghi vào đơn; chỉ ghi khi thật sự tạo vận đơn.
    if (persist) await db.order.update({ where: { id: order.id }, data: { recipientLat: override.lat, recipientLng: override.lng } })
    return { lat: override.lat, lng: override.lng, level: 'manual', source: 'manual' }
  }
  if (order.recipientLat != null && order.recipientLng != null) return { lat: order.recipientLat, lng: order.recipientLng, level: 'saved', source: 'saved' }
  const found = await geocodeAddress({ addressLine: order.addressLine, ward: order.ward, district: order.district, province: order.province })
  if (found?.level === 'address') await db.order.update({ where: { id: order.id }, data: { recipientLat: found.lat, recipientLng: found.lng } })
  return found
}

const EXACT_LEVELS = ['manual', 'saved', 'address']
export const isExactDrop = (drop) => !!drop && EXACT_LEVELS.includes(drop.level)

async function expressRatesForOrder(order, settings, db, dropOverride, persist) {
  const o = settings.shipping.goship.origin
  if (o.lat == null || o.lng == null) throw new ShipmentError('Chưa nhập tọa độ kho gửi hàng ở Cài đặt, Vận chuyển nên chưa tạo được đơn hỏa tốc.', 422, 'ORIGIN_COORDS')
  const drop = await resolveDrop(order, db, dropOverride, persist)
  if (!drop) throw new ShipmentError('Không tìm được tọa độ của địa chỉ nhận hàng. Hãy mở bản đồ, lấy tọa độ chính xác và nhập tay.', 422, 'GEOCODE_FAILED')
  let rows
  try {
    rows = await requestOndemandRates(buildOndemandRatesBody({ from: { lat: o.lat, lng: o.lng }, to: drop, weightGrams: weightFor(order, settings), name: `Đơn ${order.orderNumber}` }))
  } catch (err) {
    if (!(err instanceof GoshipError)) throw err
    throw new ShipmentError(`Goship hỏa tốc: ${err.message}`, 502, 'QUOTE_FAILED')
  }
  const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()
  const options = rows
    .map((r) => toExpressOption(r, { cod: codFor(order) }))
    .filter(Boolean)
    .sort((a, b) => a.fee - b.fee)
    .map((o2) => ({ ...o2, preferred: !!order.shippingCarrier && same(o2.carrier, order.shippingCarrier) && same(o2.service, order.shippingService) }))
  if (!options.length) throw new ShipmentError('Goship không có dịch vụ hỏa tốc cho tuyến này (hoặc số tiền thu hộ vượt mức tối đa của dịch vụ).', 422, 'NO_RATES')
  const customerChoice = order.shippingCarrier ? { carrier: order.shippingCarrier, service: order.shippingService, fee: Number(order.shippingFee) } : null
  return { options, customerChoice, express: true, drop, weightGrams: weightFor(order, settings), cod: codFor(order), subtotal: Number(order.subtotal) }
}

// Hỏi cước cho một đơn hàng cụ thể (để admin chọn hãng).
export async function ratesForOrder(orderId, db = prisma, settingsIn, opts = {}) {
  const order = await loadOrderForShipment(db, orderId)
  const settings = settingsIn || (await getSettings())
  assertCreatable(order, settings)
  // Đơn khách chọn giao HỎA TỐC: chỉ báo giá bằng API hỏa tốc (Ahamove, Grab), theo tọa độ.
  if (order.deliveryType === 'EXPRESS' && settings.shipping.goship.expressEnabled) return expressRatesForOrder(order, settings, db, opts.drop, opts.persist !== false)
  const quote = await quoteShipping({
    settings,
    address: { province: order.province, district: order.district, ward: order.ward },
    subtotal: Number(order.subtotal),
    cod: codFor(order),
    weightGrams: weightFor(order, settings),
    withSurcharge: false, // nhân viên thấy cước thật của hãng, không cộng khoản bù thêm thu khách
  })
  if (quote.status === 'incomplete') throw new ShipmentError('Địa chỉ của đơn chưa khớp danh sách tỉnh/quận/phường của Goship. Hãy sửa địa chỉ đơn rồi thử lại.', 422, 'ADDRESS_UNMATCHED')
  if (quote.status !== 'ok') throw new ShipmentError('Không lấy được cước từ Goship, vui lòng thử lại.', 502, 'QUOTE_FAILED')
  // Đánh dấu phương án khách đã chọn lúc đặt hàng (cùng hãng và gói dịch vụ) để mặc định chọn lại đúng hãng đó.
  const options = markPreferred(quote.options, order)
  const customerChoice = order.shippingCarrier ? { carrier: order.shippingCarrier, service: order.shippingService, fee: Number(order.shippingFee) } : null
  return { options, customerChoice, weightGrams: weightFor(order, settings), cod: codFor(order), subtotal: Number(order.subtotal) }
}

// Số điện thoại gửi Goship chỉ gồm chữ số (bỏ khoảng trắng, dấu chấm, gạch; +84 đổi thành 0): "0356 789 749" có thể bị hãng từ chối.
export const cleanPhone = (v) => {
  const d = String(v ?? '').replace(/[^\d+]/g, '')
  return d.startsWith('+84') ? `0${d.slice(3)}` : d.startsWith('84') && d.length >= 11 ? `0${d.slice(2)}` : d.replace(/\D/g, '')
}

// Đánh dấu phương án khách đã chọn lúc đặt hàng để nhân viên được chọn sẵn đúng hãng. Ưu tiên khớp cả hãng lẫn gói dịch vụ; không còn gói đó thì lấy
// phương án rẻ nhất CÙNG HÃNG (ưu tiên dòng của tài khoản Goship hơn dòng hợp đồng riêng), để "Chuẩn bị hàng" không rơi sang hãng khác.
export function markPreferred(options, order) {
  const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()
  const wanted = order.shippingCarrier
  if (!wanted) return options.map((o) => ({ ...o, preferred: false }))
  const exact = options.find((o) => same(o.carrier, wanted) && same(o.service, order.shippingService))
  const sameCarrier = options.filter((o) => same(o.carrier, wanted)).sort((a, b) => Number(a.ownAccount) - Number(b.ownAccount) || a.fee - b.fee)
  const chosen = exact || sameCarrier[0] || null
  return options.map((o) => ({ ...o, preferred: o === chosen }))
}

// Hãng Goship thực tế gán cho vận đơn có khớp hãng của phương án đã chọn không (so theo mã hãng ổn định). Thiếu một trong hai mã thì không kết luận được -> false.
export function carrierMismatch(option, created) {
  const want = String(option?.carrierCode || '').trim().toLowerCase()
  const got = String(created?.carrier_short_name || '').trim().toLowerCase()
  return Boolean(want && got && want !== got)
}

// Mã do HÃNG vận chuyển cấp (khác mã của Goship dạng GS...). Goship có lúc trả chính mã của họ ở trường tracking_number khi hãng chưa cấp mã:
// mã đó không quét được ở bưu cục nên không được lưu thành "mã vận đơn của hãng".
export const carrierCodeOf = (code, gcode) => {
  const c = String(code ?? '').trim()
  if (!c || (gcode && c === String(gcode)) || /^GS[A-Z0-9]{6,}$/i.test(c)) return ''
  return c
}

// Phần thân gửi Goship (thuần, kiểm thử được).
export function buildShipmentBody({ order, settings, rateId, from, to, weightGrams }) {
  const g = settings.shipping.goship
  return {
    rate: rateId,
    payer: 1, // 1 = shop trả cước cho Goship (khách đã trả phí vận chuyển cho shop trong tổng đơn); 0 = người nhận trả
    order_id: order.orderNumber, // mã đơn của mình: để webhook và tra cứu đối chiếu được
    address_from: { name: g.origin.name, phone: cleanPhone(g.origin.phone), street: g.origin.street, city: from.city, district: from.district, ward: from.ward },
    address_to: { name: order.recipientName, phone: cleanPhone(order.recipientPhone), street: order.addressLine, city: to.city, district: to.district, ward: to.ward },
    parcel: {
      cod: String(codFor(order)),
      amount: String(Math.round(Number(order.subtotal))),
      weight: String(weightGrams || g.defaultWeightGrams),
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

// Lưu vận đơn vừa tạo bên Goship (dùng lại bản ghi của vận đơn đã hủy: mỗi đơn chỉ có một bản ghi), đưa đơn sang "Chờ giao hàng" và ghi nhật ký.
function persistShipment(db, order, data, { note, local, fee, actor }) {
  return inTx(db, async (tx) => {
    const eventData = { status: LABEL[local] || local, note: `Đã tạo vận đơn thật qua ${note}` }
    const shipment = order.shipment
      ? await tx.shipment.update({ where: { id: order.shipment.id }, data: { ...data, trackingEvents: { create: eventData } } })
      : await tx.shipment.create({ data: { ...data, orderId: order.id, trackingEvents: { create: eventData } } })
    if (order.status !== 'AWAITING_SHIPMENT' && order.status !== 'SHIPPING') {
      await tx.order.update({ where: { id: order.id }, data: { status: 'AWAITING_SHIPMENT', statusEvents: { create: { status: 'AWAITING_SHIPMENT', note: 'Đã tạo vận đơn qua Goship' } } } })
    }
    await tx.activityLog.create({ data: { entityType: 'shipment', shipmentId: shipment.id, orderId: order.id, action: 'create_shipment_goship', actor, note: `${note} · cước ${fee}đ` } })
    return tx.shipment.findUniqueOrThrow({ where: { id: shipment.id }, include: { carrier: true, order: { include: { customer: true } }, trackingEvents: { orderBy: { createdAt: 'asc' } } } })
  })
}

export async function createShipmentForOrder({ orderId, rateId, actor = 'admin', settings: settingsIn, pickupMethod = null, drop: dropOverride = null, dropConfirmed = false }, db = prisma) {
  if (creating.has(orderId)) throw new ShipmentError('Đang tạo vận đơn cho đơn này, vui lòng chờ.', 409, 'IN_PROGRESS')
  creating.add(orderId)
  try {
    const order = await loadOrderForShipment(db, orderId)
    const settings = settingsIn || (await getSettings())
    assertCreatable(order, settings)

    // Hỏi lại cước ngay bây giờ: mã lựa chọn chỉ có hiệu lực trong thời gian ngắn và giá có thể đã đổi.
    const { options, drop } = await ratesForOrder(orderId, db, settings, { drop: dropOverride })
    const option = options.find((o) => o.id === rateId)
    if (!option) throw new ShipmentError('Cước vận chuyển đã thay đổi, vui lòng tải lại và chọn lại.', 409, 'RATE_CHANGED')
    if (option.onDemand) return createOnDemandShipment({ db, order, settings, option, drop, dropConfirmed, actor })

    const g = settings.shipping.goship
    const from = await resolveAddressIds(g.origin)
    const to = await resolveAddressIds({ province: order.province, district: order.district, ward: order.ward })
    if (!from || !to) throw new ShipmentError('Không đổi được địa chỉ sang mã Goship (kho gửi hoặc địa chỉ nhận không khớp danh sách).', 422, 'ADDRESS_UNMATCHED')

    const body = buildShipmentBody({ order, settings, rateId, from, to, weightGrams: weightFor(order, settings) })
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
    let status = Number(created.shipment_status)
    // Goship gán hãng khác với phương án đã chọn: vẫn lưu vận đơn (đã phát sinh thật bên Goship) nhưng ghi cảnh báo rõ để nhân viên kiểm tra / hủy.
    const mismatch = carrierMismatch(option, created)
    if (mismatch) console.error(`[goship] ${order.orderNumber}: chọn hãng ${option.carrierCode} nhưng Goship tạo bằng ${created.carrier_short_name}`)
    // Goship xử lý bất đồng bộ: vận đơn mới tạo có shipment_status 900 ("Đơn mới", chưa gửi sang hãng) và CHƯA có tracking_number, đó là bình thường,
    // mã hãng đến sau (webhook, hoặc bấm "Cập nhật từ Goship"). Chỉ coi là lỗi khi Goship không trả mã vận đơn hoặc trả kèm carrier_error có nội dung.
    const carrierErr = typeof created.carrier_error === 'string' ? created.carrier_error.trim() : created.carrier_error && Object.keys(created.carrier_error).length ? created.carrier_error : ''
    if (!gcode || carrierErr) {
      // Goship báo lỗi tạo (HTTP vẫn 200). Dọn đơn nháp nếu có, rồi báo lý do thật cho admin.
      if (gcode) await cancelGoshipShipment(gcode).catch(() => {})
      // Lý do có thể nằm ở nhiều trường tùy hãng; gom tất cả trường dạng chữ có nội dung. Cả phản hồi được ghi vào log máy chủ để tra cứu.
      console.error(`[goship] vận đơn của ${order.orderNumber} bị từ chối:`, JSON.stringify(created))
      const asText = (v) => (typeof v === 'string' ? v : v && typeof v === 'object' ? JSON.stringify(v) : '')
      const reasons = [created.carrier_error, created.message, created.status_text, created.error, created.errors, created.description, created.note]
        .map(asText)
        .map((t) => t.trim())
        .filter((t) => t && t !== '""' && t !== '{}' && t !== '[]')
      const detail = reasons.length ? [...new Set(reasons)].join(' · ') : 'Goship không nêu lý do (xem log máy chủ để biết phản hồi gốc)'
      const code = Number.isFinite(status) && status ? ` [mã trạng thái ${status}]` : ''
      throw new ShipmentError(`Hãng vận chuyển từ chối vận đơn${code}: ${detail}`, 422, 'CARRIER_ERROR')
    }

    // Chưa có mã hãng: hỏi lại Goship vài lần ngắn (thường vài giây là có). Vẫn chưa có thì lưu trước, mã tự cập nhật qua webhook hoặc nút "Cập nhật từ Goship".
    if (!carrierCodeOf(created.tracking_number, gcode)) {
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 1500))
        const found = await searchGoshipShipment(gcode).catch(() => null)
        if (found) {
          const t = found.tracking_number ?? found.carrier_code
          if (carrierCodeOf(t, gcode)) created = { ...created, tracking_number: t, sorting_code: found.sorting_code || created.sorting_code, shipment_status: found.status_code ?? found.shipment_status ?? created.shipment_status, fee: found.fee ?? created.fee }
          if (carrierCodeOf(t, gcode)) break
        }
      }
    }

    // Khách có thể vừa hủy đơn (hủy tự do khi chưa có vận đơn) trong lúc đang tạo: hủy luôn vận đơn vừa tạo bên Goship, không tạo cho đơn đã hủy.
    const nowOrder = await db.order.findUnique({ where: { id: order.id }, select: { status: true } })
    if (nowOrder && ['CANCELLED', 'RETURNED'].includes(nowOrder.status)) {
      await cancelGoshipShipment(gcode).catch(() => {})
      throw new ShipmentError('Khách vừa hủy đơn này nên đã hủy vận đơn vừa tạo bên Goship.', 409, 'ORDER_CANCELLED')
    }

    const carrier = await ensureGoshipCarrier(db)
    const noteBits = [created.carrier ? `${created.carrier}${created.carrier_short_name ? ` (${created.carrier_short_name})` : ''}` : 'Goship', carrierCodeOf(created.tracking_number, gcode) ? `mã hãng: ${created.tracking_number}` : null].filter(Boolean)
    if (mismatch) noteBits.push(`⚠ KHÁC hãng đã chọn (${option.carrier})`)
    const note = `Goship · ${noteBits.join(' · ')}`
    status = Number(created.shipment_status)
    const local = mapGoshipStatus(status).local || 'AWAITING_PICKUP'
    const fee = num(created.fee) ?? option.fee
    const data = {
      trackingId: gcode,
      sortingCode: str(created.sorting_code) || null,
      pickupMethod: pickupMethod || null, // ghi rõ cả khi rỗng: bản ghi dùng lại của vận đơn đã hủy phải bỏ lựa chọn cũ
      carrierCode: normCode(carrierCodeOf(created.tracking_number, gcode)) || null, // ghi rõ cả khi rỗng: bản ghi dùng lại của vận đơn đã hủy phải bỏ mã cũ
      onDemand: false,
      carrierId: carrier.id,
      status: local,
      senderName: g.origin.name,
      recipientName: order.recipientName,
      recipientPhone: order.recipientPhone,
      addressLine: order.addressLine,
      ward: order.ward,
      district: order.district,
      province: order.province,
      weightGrams: weightFor(order, settings),
      lengthCm: 1,
      widthCm: 1,
      heightCm: 1,
      goodsType: null,
      shippingFee: fee,
      codAmount: codFor(order),
      note,
    }

    return persistShipment(db, order, data, { note, local, fee, actor })
  } finally {
    creating.delete(orderId)
  }
}

// Tạo đơn HỎA TỐC (Ahamove, Grab) qua API hỏa tốc của Goship. Shipper được điều tới lấy NGAY sau khi tạo, nên hàng phải sẵn sàng trước.
// Điểm giao chỉ tra được tới phường/quận (không chính xác) thì bắt buộc nhân viên xác nhận đã kiểm tra vị trí trên bản đồ (dropConfirmed).
async function createOnDemandShipment({ db, order, settings, option, drop, dropConfirmed, actor }) {
  const g = settings.shipping.goship
  if (!isExactDrop(drop) && !dropConfirmed) {
    throw new ShipmentError('Vị trí giao hàng mới chỉ tìm được tới cấp phường/quận nên chưa đủ chính xác để điều shipper. Hãy kiểm tra trên bản đồ (hoặc nhập tọa độ chính xác) rồi xác nhận.', 409, 'APPROX_LOCATION')
  }
  const body = buildOndemandShipmentBody({ order, settings, option, from: { lat: g.origin.lat, lng: g.origin.lng }, to: drop, weightGrams: weightFor(order, settings), cod: codFor(order) })
  let created
  try {
    created = await createOndemandShipment(body)
  } catch (err) {
    if (!(err instanceof GoshipError)) throw err
    // Mất kết nối giữa chừng: Goship có thể đã tạo rồi. Tra theo mã đơn của mình để không điều shipper hai lần.
    if (!err.network) throw new ShipmentError(err.message, 502, 'GOSHIP_REJECTED')
    const found = await getOndemandShipment(order.orderNumber).catch(() => null)
    if (!found) throw new ShipmentError('Không kết nối được Goship, chưa tạo đơn hỏa tốc. Vui lòng thử lại.', 502, 'NETWORK')
    created = { id: found.id, code: found.code, status: found.status }
  }
  const gcode = str(created.id)
  const status = Number(created.status)
  if (!gcode || status === 1000 || created.error) {
    if (gcode) await cancelOndemandShipment(gcode).catch(() => {}) // đã tạo dở bên Goship: hủy để không điều shipper
    throw new ShipmentError(`Hãng hỏa tốc từ chối đơn${created.error_text || created.error ? `: ${str(created.error_text || created.error)}` : '.'}`, 422, 'CARRIER_ERROR')
  }
  const carrier = await ensureGoshipCarrier(db)
  const note = `Goship Hỏa tốc · ${option.carrier}${created.code ? ` · mã hãng: ${created.code}` : ''}`
  const data = {
    trackingId: gcode,
    sortingCode: null,
    pickupMethod: 'PICKUP', // shipper tới lấy ngay: không có lựa chọn mang ra bưu cục
    carrierCode: normCode(created.code) || null, // hãng thường chưa có mã ngay: webhook sẽ bổ sung
    onDemand: true,
    carrierId: carrier.id,
    status: mapOndemandStatus(status).local || 'AWAITING_PICKUP',
    senderName: g.origin.name,
    recipientName: order.recipientName,
    recipientPhone: order.recipientPhone,
    addressLine: order.addressLine,
    ward: order.ward,
    district: order.district,
    province: order.province,
    weightGrams: weightFor(order, settings),
    lengthCm: 1,
    widthCm: 1,
    heightCm: 1,
    goodsType: null,
    shippingFee: option.fee,
    codAmount: codFor(order),
    note,
  }
  return persistShipment(db, order, data, { note, local: data.status, fee: option.fee, actor })
}

// ----------------------------------------------------------------------------------------------------------------
// Hủy vận đơn
// ----------------------------------------------------------------------------------------------------------------

// Vận đơn Goship thì hủy cả bên Goship trước; Goship không hủy được thì KHÔNG đánh dấu hủy ở mình (tránh lệch: bên hãng vẫn chạy).
export async function cancelOnGoship(shipment) {
  if (shipment.carrier?.code !== GOSHIP_CARRIER_CODE) return { cancelledRemote: false }
  if (!goshipConfigured()) throw new ShipmentError('Chưa có GOSHIP_TOKEN nên không hủy được vận đơn bên Goship.', 503, 'GOSHIP_OFF')
  try {
    if (shipment.onDemand) await cancelOndemandShipment(shipment.trackingId)
    else await cancelGoshipShipment(shipment.trackingId)
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
    // Webhook của đơn HỎA TỐC có mã trạng thái KHÁC đơn thường (905 = đang giao thay vì đã giao): phải tách theo cờ này.
    onDemand: p.is_ondemand_shipment === true || p.is_ondemand_shipment === 'true' || p.is_ondemand_shipment === 1,
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

  // Loại đơn lấy theo bản ghi của mình (đáng tin hơn nội dung gửi tới). Webhook nói khác loại với bản ghi thì không tin nội dung, hỏi lại API đúng loại.
  const od = shipment.onDemand
  const trusted = verified && p.onDemand === od
  if (!trusted) {
    if (!goshipConfigured()) return { handled: false, reason: 'unverified_no_token' }
    const remote = await (od ? getOndemandShipment(shipment.trackingId) : searchGoshipShipment(shipment.trackingId)).catch(() => null)
    if (!remote) return { handled: false, reason: 'unverified_not_found' }
    p = od ? fromApiOndemand(remote, p) : fromApiShipment(remote, p)
  }

  const info = od ? mapOndemandStatus(p.status) : mapGoshipStatus(p.status)
  const label = p.statusText || info.text || LABEL[info.local] || (p.status ? `Trạng thái ${p.status}` : '')
  if (!label) return { handled: false, reason: 'no_status' }
  const note = [p.message, p.description].filter(Boolean).join(' · ') || null

  const outcome = await inTx(db, async (tx) => {
    const changes = {}
    let order = null

    if (info.cancel) {
      if (!['DELIVERED', 'RETURNED', 'NOT_CREATED'].includes(shipment.status)) changes.status = 'NOT_CREATED' // đã hủy bên Goship: đưa về như hủy vận đơn
      // Đơn đang "Chờ giao hàng" mà vận đơn đã bị hủy: đưa đơn về "Đang xử lý" để nhân viên tạo lại vận đơn (nếu không đơn kẹt ở Chờ giao hàng mà không có vận đơn).
      if (shipment.order.status === 'AWAITING_SHIPMENT') order = 'PROCESSING'
    } else {
      const next = nextShippingStatus(shipment.status, info.local)
      if (next) {
        changes.status = next
        const mapped = SHIPPING_TO_ORDER_STATUS[next]
        if (mapped && !['CANCELLED', 'RETURNED'].includes(shipment.order.status) && shipment.order.status !== mapped) order = mapped
      }
    }
    if (p.fee !== null && p.fee > 0 && Number(shipment.shippingFee) !== p.fee) changes.shippingFee = p.fee // cước thực tế hãng tính
    const realCode = carrierCodeOf(p.code, shipment.trackingId)
    if (realCode && normCode(realCode) !== shipment.carrierCode) changes.carrierCode = normCode(realCode)
    if (realCode && !String(shipment.note || '').includes(realCode)) {
      changes.note = `${String(shipment.note || 'Goship').replace(/\s·\smã hãng:.*$/, '')} · mã hãng: ${realCode}`
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
      await tx.activityLog.create({ data: { entityType: 'shipment', shipmentId: shipment.id, orderId: shipment.orderId, action: `goship_${p.status || 'event'}`, actor: 'goship', note: `${trusted ? 'webhook' : 'đối chiếu API'}: ${label}` } })
    }
    return { handled: true, status: changes.status || shipment.status, orderStatus: order, duplicate: Boolean(duplicate), verified: trusted, cancelledRemote: Boolean(info.cancel && changes.status === 'NOT_CREATED') }
  })

  // Hủy vận đơn ngay trên cổng Goship (không phải bấm hủy ở website): hủy luôn đơn hàng nếu bật trong Cài đặt, để hai bên không lệch nhau.
  // Chỉ tự hủy đơn CHƯA thanh toán (COD, chuyển khoản chưa trả): đơn đã thu tiền cần hoàn tiền nên để nhân viên quyết định.
  if (outcome.cancelledRemote) await cancelOrderAfterRemoteCancel(shipment.orderId, db)
  return outcome
}

async function cancelOrderAfterRemoteCancel(orderId, db) {
  try {
    const { orders } = await getSettings()
    if (orders.cancelOrderOnShipmentCancel === false) return
    const { applyTransition, ORDER_INCLUDE } = await import('./orderFlow.js') // nhập khi cần: orderFlow cũng nhập file này
    const order = await db.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE })
    if (!order || !['PROCESSING', 'CONFIRMED', 'AWAITING_SHIPMENT'].includes(order.status)) return
    if (order.paymentStatus === 'PAID') {
      await db.activityLog.create({ data: { entityType: 'order', orderId, action: 'shipment_cancelled_paid_order', actor: 'system', note: 'Vận đơn bị hủy bên Goship nhưng đơn đã thanh toán nên KHÔNG tự hủy đơn, nhân viên cần xử lý (tạo lại vận đơn hoặc hủy và hoàn tiền).' } })
      return
    }
    await applyTransition(order, { to: 'CANCELLED', note: 'Vận đơn đã bị hủy bên Goship nên hủy đơn hàng', actor: 'goship' }, db)
  } catch (err) {
    console.warn('[goship] không tự hủy được đơn sau khi hủy vận đơn:', err.message)
  }
}

// ----------------------------------------------------------------------------------------------------------------
// Đối soát định kỳ (phòng khi webhook của Goship không tới được: chạy máy cá nhân, mất mạng, Goship gửi lỗi...)
// ----------------------------------------------------------------------------------------------------------------

// (Không suy ra "đã hủy" chỉ vì Goship không tìm thấy mã: chưa biết tra cứu có thấy cả đơn nháp "Đơn mới" hay không, đoán sai sẽ khiến nhân viên tạo trùng vận đơn.
// Hủy bên Goship đã có webhook trạng thái 914 xử lý.)

// Hỏi lại Goship về các vận đơn Goship đang chạy và cập nhật trạng thái / mã hãng. Trả về số vận đơn có thay đổi.
export async function reconcileGoshipShipments(db = prisma, { limit = 30 } = {}) {
  if (!goshipConfigured()) return 0
  const active = await db.shipment.findMany({
    where: { carrier: { code: GOSHIP_CARRIER_CODE }, onDemand: false, trackingId: { not: null }, status: { in: ['AWAITING_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'FAILED', 'RETURNING'] } },
    orderBy: { updatedAt: 'asc' },
    take: limit,
    include: { order: true },
  })
  let changed = 0
  for (const s of active) {
    try {
      const r = await processGoshipWebhook({ payload: { gcode: s.trackingId }, verified: false }, db)
      if (r.handled && !r.duplicate) changed++
    } catch (err) {
      console.warn('[goship] đối soát', s.trackingId, 'lỗi:', err.message)
    }
  }
  return changed
}
