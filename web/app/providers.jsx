'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useCartStore } from '@/ui/context/CartContext'
import { useWishlistStore } from '@/ui/context/WishlistContext'
import { trackEvent } from '@/ui/analytics'

// Việc cần làm một lần ở trình duyệt cho mọi trang: nạp giỏ hàng/yêu thích từ localStorage và ghi nhận lượt xem trang.
export default function Providers({ children }) {
  const pathname = usePathname()

  useEffect(() => {
    useCartStore.getState().hydrate()
    useWishlistStore.getState().hydrate()
  }, [])

  useEffect(() => {
    if (!pathname.startsWith('/dashboard')) trackEvent('PAGE_VIEW')
  }, [pathname])

  return children
}
