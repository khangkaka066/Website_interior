import { shopUrl } from './mailer.js'
import { getSettings } from './settingsStore.js'

// Mọi dữ liệu do khách nhập (tên, địa chỉ, tên sản phẩm...) đều phải escape trước khi đưa vào HTML email.
const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const money = (n) => Number(n || 0).toLocaleString('vi-VN') + 'đ'

const STATUS_TEXT = {
  CONFIRMED: ['Đơn hàng đã được xác nhận', 'Shop đã xác nhận đơn và đang chuẩn bị hàng cho bạn.'],
  SHIPPING: ['Đơn hàng đang được giao', 'Đơn hàng của bạn đã được bàn giao cho đơn vị vận chuyển.'],
  DELIVERED: ['Đơn hàng đã giao thành công', 'Cảm ơn bạn đã mua sắm! Nếu có vấn đề, hãy trả lời email này hoặc liên hệ shop.'],
  CANCELLED: ['Đơn hàng đã được hủy', 'Đơn hàng đã được hủy. Nếu bạn đã thanh toán, shop sẽ liên hệ để hoàn tiền.'],
}
export const NOTIFY_STATUSES = Object.keys(STATUS_TEXT)

function layout(shopName, title, bodyHtml) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#222">
<h2 style="margin:0 0 4px">${esc(shopName)}</h2><hr style="border:none;border-top:1px solid #eee;margin:12px 0 20px">
<h3 style="margin:0 0 12px">${esc(title)}</h3>${bodyHtml}
<p style="color:#888;font-size:12px;margin-top:28px">Email tự động từ ${esc(shopName)}.</p></div>`
}

function itemsTable(order) {
  const rows = order.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0">${esc(i.name)}${i.variant ? `<br><small style="color:#888">${esc(i.variant)}</small>` : ''}</td>` +
        `<td style="padding:6px 8px;text-align:center">× ${i.quantity}</td><td style="padding:6px 0;text-align:right">${money(i.lineTotal)}</td></tr>`,
    )
    .join('')
  return `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows}
<tr><td colspan="2" style="padding:10px 0 2px;border-top:1px solid #eee">Phí vận chuyển</td><td style="text-align:right;border-top:1px solid #eee">${money(order.shippingFee)}</td></tr>
<tr><td colspan="2" style="font-weight:bold">Tổng cộng</td><td style="text-align:right;font-weight:bold">${money(order.total)}</td></tr></table>`
}

const trackLink = (order) => `${shopUrl()}/track-order?orderNumber=${encodeURIComponent(order.orderNumber)}`

export async function orderCreatedEmail(order) {
  const { store } = await getSettings()
  const subject = `Đã nhận đơn hàng ${order.orderNumber}`
  const addr = [order.addressLine, order.ward, order.district, order.province].filter(Boolean).join(', ')
  const html = layout(
    store.name,
    `Cảm ơn bạn đã đặt hàng, ${order.recipientName}!`,
    `<p>Mã đơn hàng của bạn là <strong>${esc(order.orderNumber)}</strong>. Shop sẽ liên hệ xác nhận trong thời gian sớm nhất.</p>
${itemsTable(order)}
<p style="font-size:14px">Giao tới: ${esc(addr)}<br>Thanh toán: ${esc(order.paymentMethod)}</p>
<p><a href="${esc(trackLink(order))}" style="background:#c8913f;color:#fff;padding:10px 18px;border-radius:20px;text-decoration:none;display:inline-block">Theo dõi đơn hàng</a></p>
<p style="font-size:13px;color:#666">Để tra cứu, bạn cần mã đơn và số điện thoại đã dùng khi đặt hàng.</p>`,
  )
  const text = `Cảm ơn bạn đã đặt hàng tại ${store.name}. Mã đơn: ${order.orderNumber}. Tổng: ${money(order.total)}. Theo dõi: ${trackLink(order)}`
  return { subject, html, text }
}

export async function orderStatusEmail(order, status) {
  const info = STATUS_TEXT[status]
  if (!info) return null
  const { store } = await getSettings()
  const subject = `${info[0]} — ${order.orderNumber}`
  const html = layout(
    store.name,
    info[0],
    `<p>Đơn hàng <strong>${esc(order.orderNumber)}</strong>: ${esc(info[1])}</p>
<p><a href="${esc(trackLink(order))}" style="background:#c8913f;color:#fff;padding:10px 18px;border-radius:20px;text-decoration:none;display:inline-block">Xem chi tiết đơn hàng</a></p>`,
  )
  return { subject, html, text: `${info[0]} (${order.orderNumber}). ${info[1]} Chi tiết: ${trackLink(order)}` }
}

export async function passwordResetEmail(name, token) {
  const { store } = await getSettings()
  const link = `${shopUrl()}/reset-password?token=${encodeURIComponent(token)}`
  const subject = `Đặt lại mật khẩu ${store.name}`
  const html = layout(
    store.name,
    'Đặt lại mật khẩu',
    `<p>Xin chào ${esc(name)}, chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
<p><a href="${esc(link)}" style="background:#c8913f;color:#fff;padding:10px 18px;border-radius:20px;text-decoration:none;display:inline-block">Đặt mật khẩu mới</a></p>
<p style="font-size:13px;color:#666">Liên kết có hiệu lực 1 giờ và chỉ dùng được một lần. Nếu không phải bạn yêu cầu, hãy bỏ qua email này — mật khẩu của bạn không đổi.</p>`,
  )
  return { subject, html, text: `Đặt lại mật khẩu (hiệu lực 1 giờ): ${link}\nNếu không phải bạn yêu cầu, hãy bỏ qua email này.` }
}
