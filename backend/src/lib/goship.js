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

async function goshipGet(path) {
  const base = (process.env.GOSHIP_BASE_URL || 'https://api.goship.io/api/v2').replace(/\/$/, '')
  let res
  try {
    res = await fetch(base + path, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${process.env.GOSHIP_TOKEN}`,
        // Cloudflare của Goship chặn (lỗi 1010) client không có User-Agent hợp lệ.
        'User-Agent': 'Clevinum-Backend/1.0',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new GoshipError('Không kết nối được Goship.', 502)
  }
  const body = await res.json().catch(() => null)
  if (!res.ok || !Array.isArray(body?.data)) throw new GoshipError(body?.data?.error || `Goship trả lỗi (HTTP ${res.status}).`, 502)
  return body.data
}

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

export const listCities = () => cachedGet('/cities', pick)
export const listDistricts = (cityId) => cachedGet(`/cities/${cityId}/districts`, pick)
export const listWards = (districtId) => cachedGet(`/districts/${districtId}/wards`, pick)

export function _resetGoshipCache() {
  cache.clear()
  inflight.clear()
}
