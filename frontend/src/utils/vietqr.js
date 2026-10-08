// Tạo nội dung mã QR chuyển khoản theo chuẩn VietQR (NAPAS 247, EMVCo): mở bằng app ngân hàng nào cũng
// tự điền sẵn ngân hàng, số tài khoản, số tiền và nội dung. Tạo ngay trên trình duyệt, không gọi dịch vụ ngoài.

// CRC16-CCITT (poly 0x1021, init 0xFFFF) theo yêu cầu của EMVCo.
export function crc16(str) {
  let crc = 0xffff
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

const tlv = (id, value) => id + String(value.length).padStart(2, '0') + value

// Nội dung chuyển khoản: bỏ dấu, chỉ giữ chữ, số, khoảng trắng và gạch ngang (app ngân hàng không nhận ký tự lạ).
export function sanitizeTransferNote(text, max = 50) {
  return String(text || '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

// Mẫu nội dung ở Cài đặt, ví dụ "CLEVINUM {order}": {order} được thay bằng mã đơn (hoặc số điện thoại khi chưa có đơn).
export function fillTransferNote(template, order) {
  return sanitizeTransferNote(String(template || '').replace(/\{order\}/gi, order || ''))
}

export function buildVietQrPayload({ bin, account, amount, content }) {
  if (!/^\d{6}$/.test(bin || '') || !/^\d{6,19}$/.test(account || '')) return null
  const merchant = tlv('00', 'A000000727') + tlv('01', tlv('00', bin) + tlv('01', account)) + tlv('02', 'QRIBFTTA')
  const money = Math.round(Number(amount) || 0)
  let p = tlv('00', '01') + tlv('01', money > 0 ? '12' : '11') + tlv('38', merchant) + tlv('53', '704')
  if (money > 0) p += tlv('54', String(money))
  p += tlv('58', 'VN')
  const note = sanitizeTransferNote(content)
  if (note) p += tlv('62', tlv('08', note))
  p += '6304'
  return p + crc16(p)
}
