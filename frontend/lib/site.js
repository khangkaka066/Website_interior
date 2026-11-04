// Địa chỉ công khai của website (canonical, Open Graph, dữ liệu có cấu trúc).
// Bản production không bao giờ rơi về localhost dù host thiếu biến NEXT_PUBLIC_SITE_URL.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.NODE_ENV === 'production' ? 'https://clevinium.com' : 'http://localhost:3000')
).replace(/\/+$/, '')
