// Logic thuần của đơn giao HỎA TỐC qua Goship (Ahamove, Grab): phương án giá, nội dung gửi đi, mã trạng thái. Gọi mạng nằm ở goship.js.
// Khác vận đơn thường: giao theo tọa độ, shipper được điều tới lấy NGAY, mã trạng thái và webhook riêng (cờ is_ondemand_shipment).
export const ONDEMAND_PREFIX = 'OD|'

const str = (v) => (v === undefined || v === null ? '' : String(v))
const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// Giờ dự kiến của Goship dạng "YYYY-MM-DD HH:mm:ss" (không rõ múi giờ): chỉ dùng HIỆU hai mốc nên múi giờ không ảnh hưởng.
const minutesBetween = (a, b) => {
  const x = Date.parse(String(a || '').replace(' ', 'T') + 'Z')
  const y = Date.parse(String(b || '').replace(' ', 'T') + 'Z')
  return Number.isFinite(x) && Number.isFinite(y) && y > x ? Math.round((y - x) / 60000) : null
}

// Một dòng cước hỏa tốc của Goship -> phương án cho khách / nhân viên (cùng dạng với phương án cước thường, thêm express + onDemand).
// cod: số tiền thu hộ; vượt mức thu hộ tối đa của dịch vụ thì bỏ phương án đó.
export function toExpressOption(row, { cod = 0 } = {}) {
  const fee = num(row?.total_fee)
  if (!row?._id || fee === null || fee < 0 || !row.carrier) return null
  const maxCod = num(row.max_cod)
  if (cod > 0 && maxCod && cod > maxCod) return null
  const trip = minutesBetween(row.estimated_time?.pickup, row.estimated_time?.dropoff)
  return {
    id: `${ONDEMAND_PREFIX}${row._id}|${row.carrier}`,
    carrier: str(row.carrier_name),
    logo: row.carrier_logo ? str(row.carrier_logo) : null,
    service: `Hỏa tốc${row.description_vi_vn ? ` – ${str(row.description_vi_vn)}` : ''}`,
    expected: trip ? `Lấy hàng ngay, giao trong khoảng ${trip} phút` : 'Lấy hàng ngay, giao hỏa tốc trong ngày',
    fee: Math.round(fee),
    express: true,
    onDemand: true,
    serviceId: str(row._id),
    carrierId: Number(row.carrier),
    distance: num(row.distance),
  }
}

export const isOndemandRateId = (id) => String(id || '').startsWith(ONDEMAND_PREFIX)

const parcelOf = ({ name, weightGrams, cod, amount }) => ({
  name,
  quantity: 1,
  weight: Math.max(1, Math.round(weightGrams)),
  ...(cod !== undefined ? { cod_amount: Math.round(cod) } : {}),
  ...(amount !== undefined ? { amount: Math.round(amount) } : {}),
})

// Báo cước: điểm lấy (kind 1) và điểm giao (kind 2, kèm kiện hàng).
export const buildOndemandRatesBody = ({ from, to, weightGrams, name = 'Đơn hàng' }) => ({
  paths: [
    { lat: from.lat, lng: from.lng, kind: 1 },
    { lat: to.lat, lng: to.lng, kind: 2, parcel: { name, quantity: 1, weight: Math.max(1, Math.round(weightGrams)) } },
  ],
})

const addressText = (o) => [o.street || o.addressLine, o.ward, o.district, o.province].filter(Boolean).join(', ')

// Tạo đơn hỏa tốc. option: phương án đã chọn (serviceId, carrierId). from/to: { lat, lng }.
export function buildOndemandShipmentBody({ order, settings, option, from, to, weightGrams, cod }) {
  const o = settings.shipping.goship.origin
  return {
    order_id: order.orderNumber, // mã đơn của mình: webhook và tra cứu đối chiếu được
    carrier: option.carrierId,
    vehicle: 'BIKE',
    service: option.serviceId,
    note: `Đơn ${order.orderNumber}. Gọi người nhận trước khi giao.`,
    paths: [
      { kind: 1, address: addressText(o), name: o.name, phone: o.phone, lat: from.lat, lng: from.lng },
      {
        kind: 2,
        address: addressText(order),
        name: order.recipientName,
        phone: order.recipientPhone,
        lat: to.lat,
        lng: to.lng,
        parcel: parcelOf({ name: `Đơn ${order.orderNumber}`, weightGrams, cod, amount: Number(order.subtotal) }),
      },
    ],
  }
}

// Mã trạng thái đơn HỎA TỐC (https://doc.goship.io/api/ondemand-shipment/shipment-status-code). KHÁC bảng mã của vận đơn thường
// (ví dụ 905 là "đang giao" ở đây nhưng "đã giao" ở vận đơn thường), nên webhook phải tách theo is_ondemand_shipment.
const ON_DEMAND_STATUS = {
  900: { text: 'Đơn mới (chưa gửi sang hãng)' },
  901: { local: 'AWAITING_PICKUP' },
  902: { local: 'AWAITING_PICKUP' },
  903: { local: 'AWAITING_PICKUP', text: 'Shipper đang tới lấy hàng' },
  904: { local: 'PICKED_UP' },
  905: { local: 'OUT_FOR_DELIVERY' },
  906: { local: 'DELIVERED' },
  907: { local: 'FAILED', text: 'Giao thất bại / shipper hủy đơn' },
  908: { local: 'RETURNING' },
  909: { local: 'RETURNED' },
  910: { text: 'Hoàn thành' },
  911: { cancel: true },
  1000: { text: 'Đơn lỗi (không gửi được sang hãng)' },
}
export const mapOndemandStatus = (code) => ON_DEMAND_STATUS[Number(code)] || {}

// Đơn hỏa tốc lấy từ API Goship (khi không tin được chữ ký webhook) -> cùng dạng với webhook đã chuẩn hóa.
export function fromApiOndemand(d, fallback) {
  return {
    ...fallback,
    onDemand: true,
    gcode: str(d.id ?? fallback.gcode),
    code: str(d.code ?? fallback.code),
    status: str(d.status ?? ''),
    statusText: str(d.status_text ?? ''),
    message: '',
    description: '',
    fee: num(d.total_fee) ?? fallback.fee,
    trackingUrl: str(d.tracking_url ?? fallback.trackingUrl),
  }
}
