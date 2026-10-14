// Đổi địa chỉ chữ thành tọa độ (lat/lng) cho đơn hỏa tốc: API hỏa tốc của Goship giao theo tọa độ, không dùng mã tỉnh/quận/phường.
// Nguồn tra: GEOCODE_PROVIDER = 'goong' (GOONG_API_KEY, tốt cho địa chỉ Việt Nam) | 'google' (GOOGLE_MAPS_API_KEY) | mặc định 'nominatim'
// (OpenStreetMap, không cần khóa nhưng chỉ nên dùng với lưu lượng nhỏ, tối đa 1 yêu cầu/giây và độ chính xác số nhà thấp).
// Kết quả được nhớ lại để cùng một địa chỉ không phải tra hai lần (cũng giúp phí hiển thị và phí chốt đơn cùng một tọa độ).
const TTL_MS = 30 * 24 * 3600 * 1000
const MAX_CACHE = 3000
const cache = new Map() // khóa chuẩn hóa -> { at, value }
const TIMEOUT_MS = 6000
let lastNominatim = 0
let nominatimChain = Promise.resolve()

// Tọa độ Việt Nam (kể cả hải đảo) để loại kết quả vô lý (tra nhầm sang nước khác).
const inVietnam = (lat, lng) => lat >= 8 && lat <= 24.5 && lng >= 102 && lng <= 110
const clean = (v) => String(v ?? '').trim()
const join = (parts) => parts.map(clean).filter(Boolean).join(', ')

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Clevinum-Backend/1.0', ...headers }, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// Mỗi nguồn trả { lat, lng } hoặc null.
const PROVIDERS = {
  async nominatim(q) {
    // Nominatim yêu cầu giãn cách >= 1 giây giữa hai yêu cầu: xếp hàng tuần tự.
    const run = async () => {
      const wait = Math.max(0, lastNominatim + Number(process.env.NOMINATIM_GAP_MS ?? 1100) - Date.now())
      if (wait) await new Promise((r) => setTimeout(r, wait))
      lastNominatim = Date.now()
      const rows = await fetchJson(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=vn&q=${encodeURIComponent(q)}`)
      const r = Array.isArray(rows) ? rows[0] : null
      return r ? { lat: Number(r.lat), lng: Number(r.lon) } : null
    }
    const next = nominatimChain.then(run, run)
    nominatimChain = next.catch(() => {})
    return next
  },
  async goong(q) {
    const j = await fetchJson(`https://rsapi.goong.io/geocode?address=${encodeURIComponent(q)}&api_key=${encodeURIComponent(process.env.GOONG_API_KEY || '')}`)
    const loc = j?.results?.[0]?.geometry?.location
    return loc ? { lat: Number(loc.lat), lng: Number(loc.lng) } : null
  },
  async google(q) {
    const j = await fetchJson(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&region=vn&key=${encodeURIComponent(process.env.GOOGLE_MAPS_API_KEY || '')}`)
    const loc = j?.results?.[0]?.geometry?.location
    return loc ? { lat: Number(loc.lat), lng: Number(loc.lng) } : null
  },
}

export const geocodeProvider = () => {
  const p = String(process.env.GEOCODE_PROVIDER || '').toLowerCase()
  if (p === 'goong' && process.env.GOONG_API_KEY) return 'goong'
  if (p === 'google' && process.env.GOOGLE_MAPS_API_KEY) return 'google'
  return 'nominatim'
}

async function lookup(text) {
  const key = `${geocodeProvider()}|${clean(text).toLowerCase()}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value
  let value = null
  try {
    const r = await PROVIDERS[geocodeProvider()](`${text}, Việt Nam`)
    if (r && Number.isFinite(r.lat) && Number.isFinite(r.lng) && inVietnam(r.lat, r.lng)) value = r
  } catch {
    return null // lỗi mạng / nguồn từ chối: không nhớ kết quả lỗi để lần sau thử lại
  }
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value)
  cache.set(key, { at: Date.now(), value })
  return value
}

// Tra tọa độ từ các phần địa chỉ, từ chi tiết tới thô: số nhà + phường + quận + tỉnh -> phường + quận + tỉnh -> quận + tỉnh.
// level cho biết độ chính xác thực tế ('address' | 'ward' | 'district'); maxLevel='ward' bỏ qua bước số nhà (dùng khi báo cước cho khách).
// Trả { lat, lng, level, source } hoặc null.
export async function geocodeAddress({ addressLine, ward, district, province }, { maxLevel = 'address' } = {}) {
  const tries = []
  if (maxLevel === 'address' && clean(addressLine)) tries.push(['address', join([addressLine, ward, district, province])])
  if (clean(ward)) tries.push(['ward', join([ward, district, province])])
  if (clean(district)) tries.push(['district', join([district, province])])
  for (const [level, text] of tries) {
    const r = await lookup(text)
    if (r) return { ...r, level, source: geocodeProvider() }
  }
  return null
}

export const _clearGeocodeCache = () => cache.clear()
