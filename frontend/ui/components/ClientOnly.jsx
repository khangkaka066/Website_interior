'use client'

import { useEffect, useState } from 'react'

// Chỉ vẽ phần con sau khi trang đã mở ở trình duyệt. Dùng cho thành phần phụ thuộc localStorage/sessionStorage/thời gian,
// nơi HTML từ server không thể giống lần vẽ đầu của trình duyệt.
export default function ClientOnly({ children, fallback = null }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted ? children : fallback
}
