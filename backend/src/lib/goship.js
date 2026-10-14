// Client Goship (https://doc.goship.io). Token và URL lấy từ biến môi trường, xem backend/.env.example.
// Goship dùng địa chỉ 3 cấp cũ (63 tỉnh, quận/huyện, phường/xã) với mã riêng; mã đó là thứ tính cước và tạo vận đơn cần.
export class GoshipError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'GoshipError'
    this.status = status
  }
}

const TTL_MS = 24 * 60 * 60 * 1000 // danh sách địa danh hầu như không đổi
const TIMEOUT_MS = 10_000
const cache = new Map() // đường dẫn -> { at, data }
const inflight = new Map() // đường dẫn -> Promise (nhiều khách cùng xin một danh sách chỉ gọi Goship một lần)

export const goshipConfigured = () => Boolean(process.env.GOSHIP_TOKEN)

// Gọi Goship, trả về { res, json }. Mất kết nối / quá hạn thì ném GoshipError (kèm cờ network để biết kết quả có thể chưa rõ).
async function goshipCall(method, path, body) {
  const base = (process.env.GOSHIP_BASE_URL || 'https://api.goship.io/api/v2').replace(/\/$/, '')
  let res
  try {
    res = await fetch(base + path, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${process.env.GOSHIP_TOKEN}`,
        // Cloudflare của Goship chặn (lỗi 1010) client không có User-Agent hợp lệ.
        'User-Agent': 'Clevinum-Backend/1.0',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    const err = new GoshipError('Không kết nối được Goship.', 502)
    err.network = true
    throw err
  }
  const json = await res.json().catch(() => null)
  return { res, json }
}

async function goshipRequest(path, body) {
  const { res, json } = await goshipCall(body ? 'POST' : 'GET', path, body)
  if (!res.ok || !Array.isArray(json?.data)) throw new GoshipError(json?.data?.error || json?.message || `Goship trả lỗi (HTTP ${res.status}).`, 502)
  return json.data
}

const goshipGet = (path) => goshipRequest(path)

function cachedGet(path, map) {
  const hit = cache.get(path)
  if (hit && Date.now() - hit.at < TTL_MS) return Promise.resolve(hit.data)
  if (!inflight.has(path)) {
    inflight.set(
      path,
      goshipGet(path)
        .then((rows) => {
          const data = rows.map(map).sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true }))
          cache.set(path, { at: Date.now(), data })
          return data
        })
        .finally(() => inflight.delete(path)),
    )
  }
  return inflight.get(path)
}

// Chỉ trả id và tên cho khách (bỏ support_carriers và các trường khác của Goship).
const pick = (r) => ({ id: String(r.id), name: String(r.name) })

// Mã địa danh đi vào đường dẫn gọi Goship nên chỉ nhận số.
export const isGoshipId = (v) => /^\d{1,10}$/.test(String(v))

// Hỏi cước (chỉ báo giá, không tạo vận đơn). shipment: { address_from, address_to, parcel } theo https://doc.goship.io.
export const requestRates = (shipment) => goshipRequest('/rates', { shipment })

// ---- Vận đơn (PHÁT SINH CƯỚC THẬT khi dùng token môi trường thật) ----

// Mã vận đơn Goship đi vào đường dẫn gọi Goship nên chỉ nhận chữ, số, gạch.
export const isGoshipCode = (v) => /^[A-Za-z0-9_-]{3,60}$/.test(String(v))

// Tạo vận đơn. Goship xử lý bất đồng bộ và LUÔN trả HTTP 200 kể cả khi lỗi: lỗi thể hiện ở shipment_status 900 + carrier_error,
// nên nơi gọi phải kiểm tra kết quả chứ không chỉ mã HTTP. Trả về đối tượng vận đơn của Goship (id, tracking_number, fee...).
export async function createGoshipShipment(shipment) {
  const { res, json } = await goshipCall('POST', '/shipments', { shipment })
  if (!res.ok || !json || json.status === 'error') {
    throw new GoshipError(json?.message || json?.data?.error || `Goship từ chối tạo vận đơn (HTTP ${res.status}).`, 502)
  }
  const d = json.data && !Array.isArray(json.data) && typeof json.data === 'object' ? json.data : json
  return d
}

// Hủy vận đơn (chưa lấy hàng thì mới hủy được; Goship không cho sửa, muốn đổi thì hủy và tạo lại).
export async function cancelGoshipShipment(id) {
  if (!isGoshipCode(id)) throw new GoshipError('Mã vận đơn Goship không hợp lệ.', 400)
  const { res, json } = await goshipCall('DELETE', `/shipments/${encodeURIComponent(id)}`)
  if (res.ok && (json?.code === 200 || json?.status === 'success')) return true
  const err = new GoshipError(json?.message || (typeof json?.data === 'string' ? json.data : '') || `Goship không hủy được vận đơn (HTTP ${res.status}).`, res.status === 404 ? 404 : 502)
  throw err
}

// Tìm vận đơn theo mã Goship, mã đơn của mình (order_id) hoặc mã hãng. Trả về vận đơn đầu tiên hoặc null.
export async function searchGoshipShipment(code) {
  if (!isGoshipCode(code)) return null
  const { res, json } = await goshipCall('GET', `/shipments/search?code=${encodeURIComponent(code)}`)
  if (!res.ok || !Array.isArray(json?.data)) throw new GoshipError(`Goship không tra cứu được vận đơn (HTTP ${res.status}).`, 502)
  return json.data[0] || null
}

export const listCities = () => cachedGet('/cities', pick)
export const listDistricts = (cityId) => cachedGet(`/cities/${cityId}/districts`, pick)
export const listWards = (districtId) => cachedGet(`/districts/${districtId}/wards`, pick)

// Tên các hãng Goship có mã chắc chắn; mã khác hiển thị nguyên mã của Goship (không đoán tên).
const CARRIER_NAMES = {
  vtp: 'Viettel Post',
  ghnv3: 'Giao Hàng Nhanh',
  ghtk: 'Giao Hàng Tiết Kiệm',
  jnt: 'J&T Express',
  jnt2: 'J&T Express',
  vnp: 'VNPost',
  ems: 'EMS',
  njv: 'Ninja Van',
  kerry: 'Kerry Express',
  supership: 'SuperShip',
  nhattin: 'Nhất Tín',
}

// Kiểm tra kết nối thật tới Goship (không dùng cache) cho trang quản trị: token có hợp lệ không, và Goship đang hỗ trợ những hãng nào.
// Không bao giờ trả token; thông báo lỗi do mình viết, không chuyển nguyên lời Goship.
export async function checkGoship() {
  if (!goshipConfigured()) return { configured: false, connected: false, message: 'Chưa có GOSHIP_TOKEN trong backend/.env.', carriers: [] }
  try {
    const cities = await goshipGet('/cities')
    // Goship khai báo hãng theo từng cấp địa danh (ví dụ GHN chỉ hiện ở cấp quận/huyện), nên ngoài cấp tỉnh/thành còn lấy
    // quận/huyện của hai thành phố lớn. Danh sách vẫn là "ít nhất": hãng thực tế còn tùy khu vực giao, nhận.
    const big = cities.filter((c) => ['Hà Nội', 'Hồ Chí Minh'].includes(c.name) && isGoshipId(c.id))
    const districts = (await Promise.all(big.map((c) => goshipGet(`/cities/${c.id}/districts`).catch(() => [])))).flat()
    const codes = new Set([...cities, ...districts].flatMap((c) => (Array.isArray(c.support_carriers) ? c.support_carriers : [])))
    const byName = new Map()
    for (const code of [...codes].sort()) {
      const name = CARRIER_NAMES[code] || code
      byName.set(name, [...(byName.get(name) || []), code])
    }
    const carriers = [...byName].map(([name, c]) => ({ name, codes: c })).sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    return { configured: true, connected: true, message: '', cities: cities.length, carriers, webhookSecret: Boolean(process.env.GOSHIP_CLIENT_SECRET) }
  } catch (err) {
    const rejected = /unauthenticated/i.test(err.message)
    return {
      configured: true,
      connected: false,
      message: rejected ? 'Goship từ chối token (không hợp lệ hoặc đã bị xóa). Tạo token mới ở shop.goship.io rồi cập nhật GOSHIP_TOKEN.' : 'Không kết nối được tới Goship, vui lòng thử lại.',
      carriers: [],
    }
  }
}

export function _resetGoshipCache() {
  cache.clear()
  inflight.clear()
}

// ---- Đơn giao hỏa tốc (https://doc.goship.io/api/ondemand-shipment): Ahamove, Grab. Dùng tọa độ thay cho mã tỉnh/quận/phường. ----
// Cũng PHÁT SINH CƯỚC THẬT khi tạo. Hỏa tốc LUÔN điều shipper tới lấy ngay sau khi tạo (không có lịch hẹn lấy hàng).

// Báo cước hỏa tốc: body { paths: [{ lat, lng, kind: 1 }, { lat, lng, kind: 2, parcel }], services? }.
export async function requestOndemandRates(body) {
  const { res, json } = await goshipCall('POST', '/ondemand-shipments/rates', body)
  if (!res.ok || !Array.isArray(json?.data)) {
    const detail = json?.data?.errors ? Object.values(json.data.errors).flat().join('; ') : ''
    throw new GoshipError(detail || json?.message || `Goship hỏa tốc trả lỗi (HTTP ${res.status}).`, 502)
  }
  return json.data
}

export async function createOndemandShipment(body) {
  const { res, json } = await goshipCall('POST', '/ondemand-shipments', body)
  if (!res.ok || !json || json.status === 'error') {
    const detail = json?.data?.errors ? Object.values(json.data.errors).flat().join('; ') : ''
    throw new GoshipError(detail || json?.message || `Goship từ chối tạo đơn hỏa tốc (HTTP ${res.status}).`, 502)
  }
  return json.data && !Array.isArray(json.data) && typeof json.data === 'object' ? json.data : json
}

export async function cancelOndemandShipment(id) {
  if (!isGoshipCode(id)) throw new GoshipError('Mã đơn hỏa tốc Goship không hợp lệ.', 400)
  const { res, json } = await goshipCall('DELETE', `/ondemand-shipments/${encodeURIComponent(id)}`)
  if (res.ok && (json?.code === 200 || json?.status === 'success')) return true
  throw new GoshipError(json?.message || (typeof json?.data === 'string' ? json.data : '') || `Goship không hủy được đơn hỏa tốc (HTTP ${res.status}).`, res.status === 404 || json?.code === 404 ? 404 : 502)
}

// Tra đơn hỏa tốc theo mã Goship / mã đơn của mình / mã hãng.
export async function getOndemandShipment(code) {
  if (!isGoshipCode(code)) return null
  const { res, json } = await goshipCall('GET', `/ondemand-shipments/${encodeURIComponent(code)}`)
  if (!res.ok || !json) throw new GoshipError(`Goship không tra cứu được đơn hỏa tốc (HTTP ${res.status}).`, 502)
  const d = json.data
  return Array.isArray(d) ? d[0] || null : d && typeof d === 'object' ? d : null
}
