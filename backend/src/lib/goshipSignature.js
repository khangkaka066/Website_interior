import { createHmac, timingSafeEqual } from 'node:crypto'

// Xác thực webhook của Goship: header x-goship-hmac-sha256 = HMAC-SHA256 của dữ liệu, khóa là Client Secret của bạn.
// Tài liệu Goship (https://doc.goship.io/api/shipment/webhooks) không nói rõ: băm thân request gốc hay JSON được dựng lại, mã hóa hex hay base64,
// và hai ví dụ (PHP, Node.js) khác nhau. Nên thử các cách có thể (đều cần Client Secret nên không làm yếu việc xác thực) và ghi lại cách nào khớp.

// Mô phỏng json_encode mặc định của PHP: thoát "/" thành "\/" và ký tự ngoài ASCII thành \uXXXX (ví dụ "Chờ lấy hàng").
export function phpJsonEncode(value) {
  return JSON.stringify(value)
    .replace(/\//g, '\\/')
    .replace(/[\u0080-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
}

function digests(data, secret) {
  const bin = createHmac('sha256', secret).update(data).digest()
  const hex = bin.toString('hex')
  return { 'base64(nhị phân)': bin.toString('base64'), 'base64(hex)': Buffer.from(hex).toString('base64'), hex }
}

const same = (a, b) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

// rawBody: thân request gốc (chuỗi). parsed: JSON đã đọc. Trả về { ok, scheme }.
export function verifyGoshipSignature({ rawBody, parsed, header, secret }) {
  const given = String(header || '').trim()
  if (!secret || !given) return { ok: false, scheme: null }
  const bodies = { 'thân gốc': rawBody, 'JSON dựng lại': parsed === undefined ? null : JSON.stringify(parsed), 'JSON kiểu PHP': parsed === undefined ? null : phpJsonEncode(parsed) }
  for (const [bodyName, data] of Object.entries(bodies)) {
    if (typeof data !== 'string') continue
    for (const [encName, expected] of Object.entries(digests(data, secret))) {
      if (same(given, expected)) return { ok: true, scheme: `${bodyName} + ${encName}` }
      if (encName === 'hex' && same(given.toLowerCase(), expected)) return { ok: true, scheme: `${bodyName} + ${encName}` }
    }
  }
  return { ok: false, scheme: null }
}
