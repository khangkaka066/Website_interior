import { getSettings } from '../lib/settingsStore.js'
import { goshipConfigured } from '../lib/goship.js'
import { verifyGoshipSignature } from '../lib/goshipSignature.js'
import { ShipmentError, ratesForOrder, createShipmentForOrder, processGoshipWebhook } from '../lib/goshipShipments.js'
import { toPlain } from '../utils/serialize.js'

const fail = (res, err) => res.status(err.status || 400).json({ error: err.message, ...(err.code ? { code: err.code } : {}) })

// Cấu hình để giao diện biết có hiện nút "Tạo vận đơn qua Goship" không.
export async function goshipConfig(req, res) {
  const { shipping } = await getSettings()
  const g = shipping.goship
  res.set('Cache-Control', 'no-store')
  res.json({ ready: goshipConfigured() && g.enabled && g.createShipments })
}

// Cước các hãng cho một đơn (admin chọn hãng trước khi tạo vận đơn thật).
export async function goshipRates(req, res) {
  try {
    res.set('Cache-Control', 'no-store')
    res.json(await ratesForOrder(req.params.orderId))
  } catch (err) {
    if (err instanceof ShipmentError) return fail(res, err)
    throw err
  }
}

// TẠO VẬN ĐƠN THẬT (phát sinh cước). Cần admin xác nhận tường minh: body.confirm === true.
export async function goshipCreate(req, res) {
  const { rateId, confirm } = req.body
  if (confirm !== true) return res.status(400).json({ error: 'Cần xác nhận đây là vận đơn thật.', code: 'CONFIRM_REQUIRED' })
  try {
    const shipment = await createShipmentForOrder({ orderId: req.params.orderId, rateId, actor: req.user?.username || req.user?.email || 'admin' })
    console.log(`[goship] đã tạo vận đơn ${shipment.trackingId} cho đơn ${shipment.order?.orderNumber} (${req.user?.username || 'admin'})`)
    res.status(201).json(toPlain(shipment))
  } catch (err) {
    if (err instanceof ShipmentError) return fail(res, err)
    throw err
  }
}

let loggedScheme = false

// Webhook trạng thái từ Goship (công khai: xác thực bằng chữ ký). Luôn trả 200 khi đã nhận (kể cả đơn lạ) để Goship không gửi lại vô ích;
// lỗi hệ thống thật (database...) thì để 500 cho Goship gửi lại sau 3 phút.
export async function goshipWebhook(req, res) {
  const secret = process.env.GOSHIP_CLIENT_SECRET
  const header = req.get('x-goship-hmac-sha256')
  const raw = req.rawBody ? req.rawBody.toString('utf8') : null
  const sig = verifyGoshipSignature({ rawBody: raw, parsed: req.body, header, secret })
  if (sig.ok) {
    if (!loggedScheme) {
      loggedScheme = true
      console.log(`[goship webhook] chữ ký hợp lệ theo cách: ${sig.scheme}`)
    }
  } else {
    console.warn(`[goship webhook] chữ ký không khớp (có GOSHIP_CLIENT_SECRET: ${Boolean(secret)}, có header: ${Boolean(header)}): bỏ qua nội dung, đối chiếu lại qua API Goship`)
  }
  const result = await processGoshipWebhook({ payload: req.body, verified: sig.ok })
  console.log(`[goship webhook] ${req.body?.gcode || req.body?.order_id || '?'} status=${req.body?.status ?? '?'} -> ${result.handled ? `đã xử lý (${result.status}${result.duplicate ? ', trùng' : ''})` : `bỏ qua (${result.reason})`}`)
  res.status(200).json({ ok: true })
}
