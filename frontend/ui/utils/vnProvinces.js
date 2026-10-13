import { useEffect, useState } from 'react'

// Dữ liệu tỉnh/thành và phường/xã (hành chính 2 cấp) ở public/data/vn-provinces.json,
// nguồn: thanglequoc/vietnamese-provinces-database. Chỉ tải khi trang cần, rồi giữ lại trong bộ nhớ.
let cache = null
let pending = null

function load() {
  if (cache) return Promise.resolve(cache)
  if (!pending) {
    pending = fetch('/data/vn-provinces.json')
      .then((r) => {
        if (!r.ok) throw new Error('Không tải được danh sách địa chỉ')
        return r.json()
      })
      .then((rows) => {
        cache = rows.map(([code, name, wards]) => ({
          code,
          name,
          wards: wards.map(([wCode, wName]) => ({ code: wCode, name: wName })),
        }))
        return cache
      })
      .catch((err) => {
        pending = null // cho phép thử lại lần sau
        throw err
      })
  }
  return pending
}

// status: 'loading' | 'ready' | 'error'. Khi 'error', form nên cho khách gõ tay để vẫn đặt được hàng.
export function useVnProvinces() {
  const [state, setState] = useState(() => (cache ? { status: 'ready', provinces: cache } : { status: 'loading', provinces: [] }))
  useEffect(() => {
    if (state.status === 'ready') return
    let alive = true
    load()
      .then((provinces) => alive && setState({ status: 'ready', provinces }))
      .catch(() => alive && setState({ status: 'error', provinces: [] }))
    return () => {
      alive = false
    }
  }, [state.status])
  return state
}

// Bỏ dấu và hạ chữ thường để khách gõ "ba dinh" vẫn ra "Phường Ba Đình".
export function normalizeVi(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
}

const TYPE_PREFIX = /^(thanh pho|tinh) /

// Tìm tỉnh theo tên đã lưu từ trước (có thể do khách gõ tay, ví dụ "Hồ Chí Minh" hay "TP Hồ Chí Minh").
export function findProvince(provinces, name) {
  const key = normalizeVi((name || '').trim()).replace(/^tp\.? /, 'thanh pho ')
  if (!key) return undefined
  const short = key.replace(TYPE_PREFIX, '')
  return provinces.find((p) => {
    const pk = normalizeVi(p.name)
    return pk === key || pk.replace(TYPE_PREFIX, '') === short
  })
}
