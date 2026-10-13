import { useEffect, useState } from 'react'
import { api } from '../api'

// Tỉnh / quận-huyện / phường-xã theo Goship (qua backend: /api/shop/locations/...). Mã khớp với mã Goship cần khi tính cước và tạo vận đơn.
const cache = new Map() // đường dẫn -> danh sách [{ id, name }]
const pending = new Map()

function load(path) {
  if (cache.has(path)) return Promise.resolve(cache.get(path))
  if (!pending.has(path)) {
    pending.set(
      path,
      api
        .get(path)
        .then((rows) => {
          cache.set(path, rows)
          return rows
        })
        .finally(() => pending.delete(path)),
    )
  }
  return pending.get(path)
}

// path = null: chưa cần tải (ví dụ chưa chọn tỉnh). status: 'idle' | 'loading' | 'ready' | 'error'.
// 'error' (backend chưa cấu hình Goship, Goship lỗi...) thì form nên cho khách gõ tay để vẫn đặt được hàng.
export function useLocations(path) {
  const [result, setResult] = useState({ path: null, status: 'idle', items: [] })
  useEffect(() => {
    if (!path) return undefined
    let alive = true
    load(path)
      .then((items) => alive && setResult({ path, status: 'ready', items }))
      .catch(() => alive && setResult({ path, status: 'error', items: [] }))
    return () => {
      alive = false
    }
  }, [path])
  if (!path) return { status: 'idle', items: [] }
  if (cache.has(path)) return { status: 'ready', items: cache.get(path) }
  return result.path === path ? result : { status: 'loading', items: [] }
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

const TYPE_PREFIX = /^(thanh pho|tp\.?|tinh|quan|huyen|thi xa|thi tran|phuong|xa) /

// Tìm địa danh theo tên đã lưu từ trước (địa chỉ cũ khách gõ tay: "Hồ Chí Minh", "tp ho chi minh", "Tân Bình"...).
// Khớp đúng tên trước; không thì khớp phần tên bỏ tiền tố (Quận/Huyện/Phường...), chỉ nhận khi duy nhất để không đoán bừa.
export function findByName(list, name) {
  const key = normalizeVi((name || '').trim())
  if (!key) return undefined
  const exact = list.find((i) => normalizeVi(i.name) === key)
  if (exact) return exact
  const short = key.replace(TYPE_PREFIX, '')
  const same = list.filter((i) => normalizeVi(i.name).replace(TYPE_PREFIX, '') === short)
  return same.length === 1 ? same[0] : undefined
}
