import crypto from 'node:crypto'
import { shopUrl } from './mailer.js'

// Thanh toán online qua PayOS (payos.vn): khách được chuyển sang trang thanh toán (QR VietQR / thẻ / ví), thanh toán xong PayOS gọi
// webhook về /api/payments/webhook/payos và đơn tự chuyển sang "Đã thanh toán" (dùng chung bộ xử lý với SePay/Casso).
// Bật bằng 3 biến môi trường lấy ở my.payos.vn > Kênh thanh toán: PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY.
// Chưa điền thì phương thức này không xuất hiện ở trang thanh toán.
export const PAYOS_METHOD_ID = 'PAYOS'
const API = 'https://api-merchant.payos.vn/v2/payment-requests'

export const payosConfigured = () =>
  !!(process.env.PAYOS_CLIENT_ID && process.env.PAYOS_API_KEY && process.env.PAYOS_CHECKSUM_KEY)

export const PAYOS_PUBLIC_METHOD = {
  id: PAYOS_METHOD_ID,
  label: 'Thanh toán online (PayOS)',
  description: 'Quét mã QR ngân hàng hoặc thanh toán thẻ/ví. Đơn tự xác nhận ngay khi thanh toán xong.',
}

const hmac = (data) => crypto.createHmac('sha256', process.env.PAYOS_CHECKSUM_KEY).update(data).digest('hex')

// Tạo link thanh toán cho một đơn. Trả về checkoutUrl, ném lỗi (đã dịch) nếu PayOS từ chối.
export async function createPaymentLink(order) {
  const amount = Math.round(Number(order.total))
  const returnUrl = `${shopUrl()}/order-confirmation/${order.orderNumber}`
  const cancelUrl = `${shopUrl()}/track-order?orderNumber=${encodeURIComponent(order.orderNumber)}`
  const description = order.orderNumber // mã đơn nằm trong nội dung để webhook khớp lại đơn (tối đa 25 ký tự)
  const orderCode = Date.now() // phải duy nhất mỗi lần tạo link; tạo lại link cho cùng đơn vẫn được
  const signature = hmac(`amount=${amount}&cancelUrl=${cancelUrl}&description=${description}&orderCode=${orderCode}&returnUrl=${returnUrl}`)

  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-client-id': process.env.PAYOS_CLIENT_ID, 'x-api-key': process.env.PAYOS_API_KEY },
    body: JSON.stringify({
      orderCode,
      amount,
      description,
      buyerName: order.recipientName,
      buyerPhone: order.recipientPhone,
      items: [{ name: `Đơn hàng ${order.orderNumber}`.slice(0, 100), quantity: 1, price: amount }],
      cancelUrl,
      returnUrl,
      expiredAt: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // link sống 24 giờ
      signature,
    }),
    signal: AbortSignal.timeout(15000),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || json?.code !== '00' || !json?.data?.checkoutUrl) {
    console.error('PayOS từ chối tạo link:', res.status, json?.code, json?.desc)
    throw new Error('Không tạo được link thanh toán, vui lòng thử lại sau.')
  }
  return json.data.checkoutUrl
}

// Kiểm tra chữ ký webhook: sắp xếp các field của `data` theo tên, nối "key=value&...", ký HMAC-SHA256 bằng checksum key.
export function verifyWebhookSignature(body, checksumKey) {
  if (!body?.data || typeof body.signature !== 'string') return false
  const clean = (v) => (v === null || v === undefined || v === 'null' || v === 'undefined' ? '' : v)
  const str = Object.keys(body.data)
    .sort()
    .map((k) => `${k}=${clean(body.data[k])}`)
    .join('&')
  const expected = crypto.createHmac('sha256', checksumKey).update(str).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(body.signature)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
