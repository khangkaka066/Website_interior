import { Be_Vietnam_Pro } from 'next/font/google'
import Providers from './providers'
import './globals.css'

const beVietnam = Be_Vietnam_Pro({
  variable: '--font-be-vietnam',
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  // Không tải trước cả 10 file (5 độ đậm x 2 bộ ký tự): trình duyệt chỉ tải file nào trang thật sự dùng, hết cảnh báo "preloaded but not used".
  preload: false,
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'CLEVINUM — Rèm Việt Giá Sỉ', template: '%s | CLEVINUM' },
  description: 'CLEVINUM — rèm cửa chất lượng cao, giá xưởng: rèm ore, rèm dán tường, rèm voan, thanh treo và phụ kiện. Giao hàng toàn quốc.',
  openGraph: { type: 'website', siteName: 'CLEVINUM', locale: 'vi_VN' },
}

export const viewport = { themeColor: '#c8913f' }

// suppressHydrationWarning trên <html>: tiện ích trình duyệt (dịch trang, trình quản lý mật khẩu...) hay chèn thuộc tính vào đây
// trước khi React chạy, gây cảnh báo lệch hydration dù code không sai.
export default function RootLayout({ children }) {
  return (
    <html lang="vi" className={beVietnam.variable} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
