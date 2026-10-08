import nodemailer from 'nodemailer'

// Gửi email qua SMTP. Cấu hình bằng biến môi trường (xem .env.example): SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM.
// Chưa cấu hình SMTP thì KHÔNG gửi mà in nội dung email ra log máy chủ (tiện chạy thử trên máy cá nhân).
// sendMail không bao giờ ném lỗi ra ngoài: email hỏng không được làm hỏng đơn hàng hay đăng nhập.
let transport = null
const configured = () => !!process.env.SMTP_HOST

function getTransport() {
  transport ||= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  })
  return transport
}

export const shopUrl = () => (process.env.SHOP_URL || 'http://localhost:3000').replace(/\/$/, '')

export async function sendMail({ to, subject, html, text }) {
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return false
  if (!configured()) {
    console.log(`[mail:chưa cấu hình SMTP] tới ${to} | ${subject}\n${text}\n`)
    return false
  }
  try {
    await getTransport().sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
      text,
    })
    return true
  } catch (err) {
    console.error('Gửi email thất bại:', err.message)
    return false
  }
}
