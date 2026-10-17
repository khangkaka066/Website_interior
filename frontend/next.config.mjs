const BACKEND = process.env.BACKEND_URL || 'http://localhost:4000'

// Content Security Policy (chỉ production: dev cần 'unsafe-eval' cho hot reload). Next chèn script inline để hydrate nên script-src còn
// 'unsafe-inline' (CSP chặt hơn bằng nonce cần render động mọi trang, mất cache tĩnh). Các chỉ thị còn lại vẫn chặn script/iframe/form lạ.
const API_ORIGIN = process.env.NEXT_PUBLIC_API_BASE_URL || ''
// Nền tảng quảng cáo chỉ được thêm vào CSP khi đã khai báo ID tương ứng (không khai báo = không mở thêm tên miền nào).
const adSrc = []
const adConnect = []
const adFrame = []
if (process.env.NEXT_PUBLIC_META_PIXEL_ID) {
  adSrc.push('https://connect.facebook.net')
  adConnect.push('https://www.facebook.com', 'https://connect.facebook.net')
}
if (process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID) {
  adSrc.push('https://analytics.tiktok.com')
  adConnect.push('https://analytics.tiktok.com', 'https://analytics-ipv6.tiktokw.us', 'https://business-api.tiktok.com')
}
if (process.env.NEXT_PUBLIC_GOOGLE_TAG_ID) {
  adSrc.push('https://www.googletagmanager.com', 'https://www.google-analytics.com')
  adConnect.push('https://www.googletagmanager.com', 'https://*.google-analytics.com', 'https://*.analytics.google.com', 'https://*.doubleclick.net', 'https://www.google.com', 'https://*.googleadservices.com')
  adFrame.push('https://www.googletagmanager.com', 'https://td.doubleclick.net')
}
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://accounts.google.com ${adSrc.join(' ')}`.trim(),
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://accounts.google.com ${API_ORIGIN} ${adConnect.join(' ')}`.trim(),
  `frame-src 'self' https://accounts.google.com https://www.google.com ${adFrame.join(' ')}`.trim(),
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ')

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  ...(process.env.NODE_ENV === 'production' ? [{ key: 'Content-Security-Policy', value: csp }] : []),
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Next chuyển tiếp /api sang backend và mặc định cắt sau 30 giây (trả "Internal Server Error"). Công cụ Từ khóa SEO gọi AI qua OpenRouter
  // (mô hình miễn phí có thể mất 30-90 giây) nên nâng lên 3 phút.
  experimental: { proxyTimeout: 180_000 },
  // Mở trang dev qua đường hầm (VS Code Dev Tunnels, Cloudflare Tunnel...): không khai báo thì Next chặn tài nguyên dev (JS, HMR) từ tên miền lạ
  // nên trang tải ra nhưng không chạy. Chỉ có tác dụng ở `next dev`.
  allowedDevOrigins: ['**.devtunnels.ms', '**.trycloudflare.com'],
  // Cho phép build thử ở thư mục riêng (NEXT_DIST_DIR) mà không đụng tới server dev đang chạy.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Thư mục gốc của dự án (có package-lock.json riêng ở thư mục cha nên Next dễ đoán nhầm).
  turbopack: { root: import.meta.dirname },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Ảnh/tệp tĩnh trong public/: cho trình duyệt và CDN nhớ lâu (tải lại trang nhanh hơn, điểm Core Web Vitals tốt hơn).
      { source: '/images/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=2592000' }] },
    ]
  },
  // Trình duyệt chỉ nói chuyện với một địa chỉ (Next): /api và các file SEO do backend sinh ra được chuyển tiếp sang backend.
  // Nhờ vậy không cần CORS, và link/webhook dùng chung một tên miền khi deploy.
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${BACKEND}/api/:path*` },
      { source: '/robots.txt', destination: `${BACKEND}/robots.txt` },
      { source: '/sitemap.xml', destination: `${BACKEND}/sitemap.xml` },
    ]
  },
}

export default nextConfig
