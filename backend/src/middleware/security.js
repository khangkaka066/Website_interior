import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'

const minutes = (n) => n * 60 * 1000
const tooMany = { error: 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.' }

function limiter(windowMs, limit, extra = {}) {
  return rateLimit({ windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false, message: tooMany, ...extra })
}

// Header bảo mật. API chỉ trả JSON nên CSP chặn hết (không cho nhúng/chạy gì); CORP mở để frontend khác origin đọc được.
export const securityHeaders = helmet({
  contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
})

// Nén JSON (danh sách sản phẩm rất lớn).
// Luồng sự kiện (SSE) không được nén/gom đệm, nếu không tin nhắn sẽ tới trễ.
export const compress = compression({
  filter: (req, res) => !String(res.getHeader('Content-Type') || '').startsWith('text/event-stream') && compression.filter(req, res),
})

// Chặn lạm dụng chung theo IP.
export const globalLimiter = limiter(minutes(1), 600)

// Chống brute-force: chỉ tính các lần đăng nhập/đăng ký thất bại.
export const loginLimiter = limiter(minutes(15), 10, { skipSuccessfulRequests: true })
export const registerLimiter = limiter(minutes(60), 10)

// Route công khai ghi dữ liệu: đặt hàng và chat của khách.
export const orderLimiter = limiter(minutes(60), 20)
export const chatLimiter = limiter(minutes(1), 60)

// Sự kiện theo dõi của khách (công khai): đủ cho một phiên duyệt web bình thường, chặn bơm rác vào database.
export const analyticsLimiter = limiter(minutes(1), 120)

// Tra cứu đơn của khách (công khai): chặn dò mã đơn + số điện thoại hàng loạt.
export const trackLimiter = limiter(minutes(15), 30)

// Quên mật khẩu / đặt lại mật khẩu (công khai): chặn spam email và dò mã.
export const forgotLimiter = limiter(minutes(15), 10)
