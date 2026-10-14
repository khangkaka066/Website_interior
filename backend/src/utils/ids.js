import { randomInt } from 'node:crypto'

// Bỏ chữ I và O để khách đọc/gõ không nhầm với số 1 và 0.
const ORDER_ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'

// Mã đơn dạng Shopee: 6 số ngày đặt (YYMMDD, giờ Việt Nam) + 8 ký tự ngẫu nhiên, ví dụ 2611148M5W6ABM (14 ký tự).
// Ngẫu nhiên nên không dò được mã đơn khác từ mã của mình; ~1.800 tỷ khả năng mỗi ngày nên trùng rất hiếm (nếu trùng, tạo đơn tự thử lại).
export function generateOrderNumber(now = new Date()) {
  const vn = new Date(now.getTime() + 7 * 3600 * 1000)
  const yymmdd = `${String(vn.getUTCFullYear()).slice(2)}${String(vn.getUTCMonth() + 1).padStart(2, '0')}${String(vn.getUTCDate()).padStart(2, '0')}`
  let rand = ''
  for (let i = 0; i < 8; i++) rand += ORDER_ALPHABET[randomInt(ORDER_ALPHABET.length)]
  return yymmdd + rand
}

export function generateTrackingId(carrierCode) {
  const n = Math.floor(100000000 + Math.random() * 900000000)
  return `${carrierCode}${n}`
}
