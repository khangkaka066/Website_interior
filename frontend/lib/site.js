// Địa chỉ công khai của website (canonical, Open Graph, dữ liệu có cấu trúc).
// Mặc định là https://clevinium.com. Biến NEXT_PUBLIC_SITE_URL chỉ ghi đè khi có giá trị; bản production bỏ qua giá trị
// trỏ về localhost (ví dụ host chép nhầm từ .env.example) để canonical không bao giờ báo cho Google địa chỉ nội bộ.
const DEFAULT_URL = 'https://clevinium.com'
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i

const fromEnv = (process.env.NEXT_PUBLIC_SITE_URL || '').trim()
const useEnv = fromEnv && !(process.env.NODE_ENV === 'production' && LOCAL.test(fromEnv))

export const SITE_URL = (useEnv ? fromEnv : DEFAULT_URL).replace(/\/+$/, '')
