import crypto from 'node:crypto'
import { prisma } from './prisma.js'
import { getSettings } from './settingsStore.js'
import { verifyWebhookSignature } from './payos.js'

// Tự động xác nhận thanh toán chuyển khoản khi dịch vụ theo dõi ngân hàng (SePay, Casso) báo có tiền về.
// Khớp đơn bằng MÃ ĐƠN trong nội dung chuyển khoản (ORD-12345) và số tiền. Giao dịch không khớp thì KHÔNG tự xác nhận,
// mà ghi lại để hiện ở mục Thanh toán cho bạn xử lý tay.

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a))
  const y = Buffer.from(String(b))
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

// Mỗi dịch vụ: lấy khóa bí mật từ biến môi trường, kiểm tra yêu cầu, đổi dữ liệu về dạng chung.
export const PROVIDERS = {
  payos: {
    name: 'PayOS',
    secret: () => process.env.PAYOS_CHECKSUM_KEY,
    // PayOS không dùng header khóa: chữ ký HMAC nằm trong chính nội dung gửi tới.
    authorized: (req, secret) => verifyWebhookSignature(req.body, secret),
    // Chỉ nhận giao dịch thành công. account để trống: tiền về tài khoản đã liên kết với PayOS, không cần khớp tài khoản trong Cài đặt.
    parse: (b) =>
      b?.success !== false && b?.data?.code === '00' && Number(b.data.amount) > 0
        ? [{ externalId: String(b.data.reference || b.data.paymentLinkId || b.data.orderCode), amount: Number(b.data.amount), content: String(b.data.description || ''), account: '', ref: b.data.reference || '' }]
        : [],
    ok: { success: true },
  },
  sepay: {
    name: 'SePay',
    secret: () => process.env.SEPAY_WEBHOOK_API_KEY,
    // SePay gửi header: Authorization: Apikey <khóa>
    authorized: (req, secret) => safeEqual(req.get('authorization') || '', `Apikey ${secret}`),
    parse: (b) =>
      b && b.transferType === 'in' && Number(b.transferAmount) > 0
        ? [{ externalId: String(b.id), amount: Number(b.transferAmount), content: [b.content, b.description].filter(Boolean).join(' '), account: String(b.accountNumber || ''), ref: b.referenceCode || '' }]
        : [],
    ok: { success: true }, // SePay yêu cầu trả đúng {"success": true} với mã 200 hoặc 201
  },
  casso: {
    name: 'Casso',
    secret: () => process.env.CASSO_WEBHOOK_SECRET,
    // Tên header chứa khóa bảo mật: tài liệu Casso không ghi rõ trong trang đã đọc -> đặt được bằng CASSO_WEBHOOK_HEADER.
    authorized: (req, secret) => safeEqual(req.get(process.env.CASSO_WEBHOOK_HEADER || 'secure-token') || '', secret),
    parse: (b) =>
      (Array.isArray(b?.data) ? b.data : [])
        .filter((t) => Number(t.amount) > 0) // tiền vào là số dương
        .map((t) => ({ externalId: String(t.id), amount: Number(t.amount), content: String(t.description || ''), account: String(t.subAccId || t.bank_sub_acc_id || ''), ref: t.tid || '' })),
    ok: { success: true, error: 0 },
  },
}

export function webhookStatus() {
  return Object.fromEntries(Object.entries(PROVIDERS).map(([k, p]) => [k, { name: p.name, enabled: !!p.secret() }]))
}

// Ngân hàng có thể bỏ gạch ngang / đổi hoa thường: nhận cả "ORD-12345", "ord12345", "ORD 12345".
export function extractOrderNumber(text) {
  const m = /ORD[\s-]?(\d{5})/i.exec(String(text || ''))
  return m ? `ORD-${m[1]}` : null
}

const money = (n) => Number(n).toLocaleString('vi-VN') + 'đ'

// Xử lý một giao dịch tiền vào. Trả về { result, orderNumber? } với result:
// confirmed | duplicate | mismatch | unmatched | ignored
export async function processTransaction(provider, tx, db = prisma) {
  const marker = `[${provider}:${tx.externalId}]`

  // Dịch vụ có thể gửi lại cùng một giao dịch (retry): đã xử lý rồi thì bỏ qua.
  if (await db.activityLog.findFirst({ where: { note: { contains: marker } }, select: { id: true } })) return { result: 'duplicate' }

  // Tiền về tài khoản khác của cùng dịch vụ (không phải tài khoản nhận thanh toán của shop) thì không liên quan.
  const { payment } = await getSettings()
  const shopAccount = payment.methods.find((m) => m.bank)?.bank?.accountNumber
  if (shopAccount && tx.account && tx.account !== shopAccount) return { result: 'ignored' }

  const unmatched = async (reason) => {
    await db.activityLog.create({
      data: { entityType: 'payment', action: 'payment_unmatched', actor: `webhook:${provider}`, note: `${marker} ${money(tx.amount)} · "${tx.content.slice(0, 120)}" · ${reason}` },
    })
    return { result: 'unmatched' }
  }

  const orderNumber = extractOrderNumber(tx.content)
  if (!orderNumber) return unmatched('nội dung không có mã đơn')
  const order = await db.order.findUnique({
    where: { orderNumber },
    select: { id: true, orderNumber: true, status: true, paymentStatus: true, paymentMethod: true, total: true },
  })
  if (!order) return unmatched(`mã đơn ${orderNumber} không tồn tại`)
  if (order.paymentMethod === 'COD') return unmatched(`đơn ${orderNumber} chọn COD`)
  if (['CANCELLED', 'RETURNED'].includes(order.status)) return unmatched(`đơn ${orderNumber} đã hủy/trả hàng, cần hoàn tiền`)
  if (order.paymentStatus === 'PAID') return unmatched(`đơn ${orderNumber} đã thanh toán trước đó (chuyển trùng?)`)
  if (order.paymentStatus === 'REFUNDED') return unmatched(`đơn ${orderNumber} đã hoàn tiền`)

  const total = Number(order.total)
  if (tx.amount < total) {
    await db.activityLog.create({
      data: { entityType: 'order', orderId: order.id, action: 'payment_mismatch', actor: `webhook:${provider}`, note: `${marker} Nhận ${money(tx.amount)}, đơn cần ${money(total)} (thiếu ${money(total - tx.amount)}). Chưa tự xác nhận.` },
    })
    return { result: 'mismatch', orderNumber }
  }

  // updateMany có điều kiện: hai yêu cầu gửi cùng lúc thì chỉ một yêu cầu thắng.
  const done = await db.$transaction(async (t) => {
    const r = await t.order.updateMany({
      where: { id: order.id, paymentStatus: { in: ['AWAITING_PAYMENT', 'FAILED'] } },
      data: { paymentStatus: 'PAID', transactionId: `${provider}:${tx.externalId}` },
    })
    if (r.count !== 1) return false
    const over = tx.amount > total ? ` (dư ${money(tx.amount - total)})` : ''
    await t.activityLog.create({
      data: { entityType: 'order', orderId: order.id, action: 'auto_confirm_payment', actor: `webhook:${provider}`, note: `${marker} Tự động xác nhận: nhận ${money(tx.amount)}${over}${tx.ref ? ` · mã ngân hàng ${tx.ref}` : ''}` },
    })
    return true
  })
  return done ? { result: 'confirmed', orderNumber } : { result: 'duplicate' }
}

export async function handleWebhook(req, res) {
  const provider = PROVIDERS[req.params.provider]
  if (!provider) return res.status(404).json({ error: 'Không có dịch vụ này.' })
  const secret = provider.secret()
  if (!secret) return res.status(503).json({ error: `Chưa cấu hình ${provider.name} (thiếu khóa bí mật trong biến môi trường).` })
  if (!provider.authorized(req, secret)) return res.status(401).json({ error: 'Sai khóa xác thực.' })

  const results = []
  for (const tx of provider.parse(req.body)) results.push(await processTransaction(req.params.provider, tx))
  res.status(200).json({ ...provider.ok, processed: results.length })
}
