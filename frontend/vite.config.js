import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Các trang đã chuyển sang Next (web/): mở bằng cổng Vite (5173) thì chuyển tiếp sang Next, nếu không sẽ ra trang trắng.
const NEXT = process.env.NEXT_URL || 'http://localhost:3000'
const BACKEND = process.env.BACKEND_URL || 'http://localhost:4000'
const nextPaths = ['/about', '/contact', '/faq', '/configure']
// Tài nguyên của trang Next (CSS/JS/font, kênh HMR): không chuyển tiếp thì các trang trên hiện không có giao diện vì trình duyệt nhận HTML thay cho CSS.
const nextAssetPaths = ['/_next', '/__nextjs_original-stack-frames', '/__nextjs_source-map']
const seoPaths = ['/robots.txt', '/sitemap.xml'] // do backend sinh ra (có danh sách sản phẩm)

// Content Security Policy cho bản build (dev cần script inline của Vite nên không áp dụng): chỉ cho phép chạy script của
// chính trang và Google đăng nhập, chặn script/iframe/form lạ (giảm thiệt hại nếu có lỗ hổng XSS). Ảnh cho phép mọi https
// vì ảnh sản phẩm do admin nhập có thể ở nhiều nơi; style cần 'unsafe-inline' vì giao diện dùng style="..." nhiều chỗ.
// `frame-ancestors` không đặt được bằng thẻ meta: cấu hình ở máy chủ/CDN khi deploy.
const API = process.env.VITE_API_BASE_URL || ''
const csp = [
  "default-src 'self'",
  "script-src 'self' https://accounts.google.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' data: blob: https:",
  `connect-src 'self' https://www.googleapis.com https://accounts.google.com ${API}`.trim(),
  'frame-src https://accounts.google.com',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const cspPlugin = {
  name: 'clevinum-csp',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp }, injectTo: 'head-prepend' },
  ],
}

export default defineConfig({
  plugins: [react(), cspPlugin],
  // Khi Next (cổng 3000) proxy sang Vite, HMR vẫn nối thẳng tới Vite để khỏi tự reload lặp.
  server: {
    hmr: { host: 'localhost', clientPort: 5173 },
    proxy: {
      ...Object.fromEntries(nextPaths.map((p) => [p, { target: NEXT, changeOrigin: true }])),
      ...Object.fromEntries(nextAssetPaths.map((p) => [p, { target: NEXT, changeOrigin: true, ws: true }])),
      ...Object.fromEntries(seoPaths.map((p) => [p, { target: BACKEND, changeOrigin: true }])),
      '/api': { target: BACKEND, changeOrigin: true },
    },
  },
})
