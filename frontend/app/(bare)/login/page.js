import Script from 'next/script'
import { Login } from '@/ui/clientViews'

export const metadata = { title: 'Đăng nhập' }

export default function Page() {
  return (
    <>
      {/* Google Identity Services cho nút "Đăng nhập bằng Google" (CSP đã cho phép accounts.google.com). Chỉ tải ở trang này. */}
      {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />}
      <Login />
    </>
  )
}
