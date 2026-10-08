import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { isAdmin } from '../auth'
import { seedAdminProducts, syncProductsWithServer } from '../data/adminProducts'
import { useSeo } from '../useSeo'

export default function RequireAdmin({ children }) {
  useSeo({ title: 'Quản trị', noindex: true })
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
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [admin])

  if (!admin) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (!ready) return null

  return children
}
