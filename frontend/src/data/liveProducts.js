import { useSyncExternalStore } from 'react'
import { products as bundled } from './shop'
import { api } from '../api'

// Sản phẩm website bán hàng lấy từ backend (nơi admin nhập Excel/sửa giá), nên đổi là thấy.
// Lúc chưa tải xong (hoặc backend lỗi) dùng bản đóng gói sẵn trong data/shop.js để trang không trống.
const REFRESH_MS = 30000
let current = bundled
let timer = null
const listeners = new Set()

async function refresh() {
  try {
    const next = await api.get('/shop/products')
    if (Array.isArray(next) && JSON.stringify(next) !== JSON.stringify(current)) {
      current = next
      listeners.forEach((l) => l())
    }
  } catch {
    // giữ bản hiện có
  }
}

const onVisible = () => {
  if (document.visibilityState === 'visible') refresh()
}

function subscribe(listener) {
  listeners.add(listener)
  if (listeners.size === 1) {
    refresh()
    timer = setInterval(refresh, REFRESH_MS)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', refresh)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', refresh)
    }
  }
}

export function useProducts() {
  return useSyncExternalStore(subscribe, () => current)
}
