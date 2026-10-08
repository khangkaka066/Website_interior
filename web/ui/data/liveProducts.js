'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { products as bundled } from './shop'
import { api } from '../api'

// Sản phẩm website bán hàng lấy từ backend (nơi admin nhập Excel/sửa giá), nên đổi là thấy.
// Máy chủ Next lấy danh sách sẵn và truyền vào `initial` (nên HTML đầu tiên đã có sản phẩm thật cho Google và khách);
// trình duyệt sau đó tự làm mới mỗi 30 giây và khi quay lại tab. Backend lỗi thì dùng bản đóng gói sẵn trong data/shop.js.
const REFRESH_MS = 30000
const ProductsContext = createContext(bundled)

export function ProductsProvider({ initial, children }) {
  const [products, setProducts] = useState(initial?.length ? initial : bundled)

  useEffect(() => {
    let alive = true
    const refresh = async () => {
      try {
        const next = await api.get('/shop/products')
        if (alive && Array.isArray(next)) setProducts((cur) => (JSON.stringify(next) !== JSON.stringify(cur) ? next : cur))
      } catch {
        // giữ bản hiện có
      }
    }
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    refresh()
    const timer = setInterval(refresh, REFRESH_MS)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', refresh)
    return () => {
      alive = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  return <ProductsContext.Provider value={products}>{children}</ProductsContext.Provider>
}

export function useProducts() {
  return useContext(ProductsContext)
}
