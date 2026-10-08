'use client'

import dynamic from 'next/dynamic'
import ClientOnly from './components/ClientOnly'
import { PageSpinner } from './components/PageLoading'

// Các trang chỉ chạy ở trình duyệt (phụ thuộc giỏ hàng, phiên đăng nhập, localStorage...): không vẽ ở server.
// `ssr: false` phải khai báo trong Client Component, nên gom ở đây để các route (Server Component) import.
const lazy = (loader) => dynamic(loader, { ssr: false, loading: () => <PageSpinner /> })

export const Cart = lazy(() => import('./pages/Cart'))
export const Checkout = lazy(() => import('./pages/Checkout'))
export const OrderConfirmation = lazy(() => import('./pages/OrderConfirmation'))
export const TrackOrder = lazy(() => import('./pages/TrackOrder'))
export const Wishlist = lazy(() => import('./pages/Wishlist'))
export const Login = lazy(() => import('./pages/Login'))
export const ResetPassword = lazy(() => import('./pages/ResetPassword'))

export function Client({ children }) {
  return <ClientOnly>{children}</ClientOnly>
}
