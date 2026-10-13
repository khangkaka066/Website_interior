'use client'

import dynamic from 'next/dynamic'
import ClientOnly from './components/ClientOnly'
import { PageSpinner } from './components/PageLoading'

// Các trang chỉ chạy ở trình duyệt (phụ thuộc giỏ hàng, phiên đăng nhập, localStorage...): không vẽ ở server.
// `ssr: false` phải khai báo trong Client Component, nên gom ở đây để các route (Server Component) import.
const loaders = {
  Cart: () => import('./pages/Cart'),
  Checkout: () => import('./pages/Checkout'),
  OrderConfirmation: () => import('./pages/OrderConfirmation'),
  TrackOrder: () => import('./pages/TrackOrder'),
  Wishlist: () => import('./pages/Wishlist'),
  Login: () => import('./pages/Login'),
  Account: () => import('../components/account/AccountPage'),
  ResetPassword: () => import('./pages/ResetPassword'),
}
const lazy = (name) => dynamic(loaders[name], { ssr: false, loading: () => <PageSpinner /> })

export const Cart = lazy('Cart')
export const Checkout = lazy('Checkout')
export const OrderConfirmation = lazy('OrderConfirmation')
export const TrackOrder = lazy('TrackOrder')
export const Wishlist = lazy('Wishlist')
export const Login = lazy('Login')
export const Account = lazy('Account')
export const ResetPassword = lazy('ResetPassword')

// Tải sẵn mã của các trang trong luồng mua hàng khi trình duyệt rảnh, để bấm sang giỏ hàng / thanh toán là hiện ngay, không phải chờ
// tải file (và vòng xoay "Đang tải…" mà React còn giữ lại ~300ms). Nút "Thanh toán" là nút chứ không phải link nên Next không tự tải trước.
export function preloadShoppingViews() {
  for (const name of ['Cart', 'Checkout', 'Wishlist', 'TrackOrder']) loaders[name]()
}

export function Client({ children }) {
  return <ClientOnly>{children}</ClientOnly>
}
