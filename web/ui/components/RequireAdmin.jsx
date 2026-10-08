'use client'

import { useEffect, useState } from 'react'
import { Navigate, useLocation } from '@/lib/router'
import { isAdmin } from '../auth'
import { seedAdminProducts, syncProductsWithServer } from '../data/adminProducts'

export default function RequireAdmin({ children }) {
  const location = useLocation()
  const admin = isAdmin()
  const [ready, setReady] = useState(false)

  // Nạp dữ liệu sản phẩm mẫu trước khi các trang admin đọc danh sách.
  useEffect(() => {
    if (!admin) return
    let cancelled = false
    // Đồng bộ với server trước, rồi mới nạp seed (nếu seed thêm gì thì tự đẩy lên server).
    syncProductsWithServer()
      .then(seedAdminProducts)
      .finally(() => !cancelled && setReady(true))
    // Quay lại tab quản trị: lấy lại số tồn kho mới nhất (đơn mới đã trừ kho ở server) trước khi sửa tiếp.
    const refresh = () => {
      if (document.visibilityState === 'visible') syncProductsWithServer()
    }
    document.addEventListener('visibilitychange', refresh)
    // Máy khác nhập Excel/sửa giá thì máy này tự thấy trong tối đa 30 giây, không cần tải lại trang.
    const timer = setInterval(refresh, 30000)
    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [admin])

  if (!admin) {
    return <Navigate to={`/login?from=${encodeURIComponent(location.pathname)}`} replace />
  }
  if (!ready) return null

  return children
}
