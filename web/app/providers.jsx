'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useCartStore } from '@/ui/context/CartContext'
import { useWishlistStore } from '@/ui/context/WishlistContext'
import { Suspense } from 'react'
import { trackEvent } from '@/ui/analytics'
import TopLoader from '@/ui/components/TopLoader'

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

  return (
    <>
      <Suspense fallback={null}>
        <TopLoader />
      </Suspense>
      {children}
    </>
  )
}
