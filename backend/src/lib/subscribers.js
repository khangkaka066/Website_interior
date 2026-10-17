import crypto from 'node:crypto'
import { prisma } from './prisma.js'
import { getSettings } from './settingsStore.js'
import { sendMail } from './mailer.js'
import { welcomeEmail, blastEmail } from './emailTemplates.js'

// Đăng ký email, quà chào mừng và gửi chiến dịch.

const DAY = 86400000
const newCode = () => `HELLO-${crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6)}`

// Tạo mã giảm giá riêng (dùng 1 lần) theo cấu hình "Quà chào mừng". Trả về null nếu tắt.
async function createWelcomeCoupon(db = prisma) {
  const { marketing: m } = await getSettings()
  if (!m.welcomeEnabled) return null
  const data = {
    description: 'Quà chào mừng khi đăng ký email',
    type: m.welcomeType === 'FIXED' ? 'FIXED' : 'PERCENT',
    value: m.welcomeValue,
    maxDiscount: m.welcomeType === 'PERCENT' && m.welcomeMaxDiscount > 0 ? m.welcomeMaxDiscount : null,
    minOrder: m.welcomeMinOrder || 0,
    usageLimit: 1,
    perCustomerLimit: 1,
    endsAt: m.welcomeDays > 0 ? new Date(Date.now() + m.welcomeDays * DAY) : null,
  }
  for (let i = 0; i < 5; i++) {
    try {
      return await db.coupon.create({ data: { ...data, code: newCode() } })
    } catch (err) {
      if (err?.code !== 'P2002') throw err // trùng mã (rất hiếm): thử mã khác
    }
  }
  return null
}

// Khách đăng ký. Email mới (hoặc đăng ký lại sau khi hủy mà chưa từng nhận quà) thì tặng mã chào mừng qua email.
// Đăng ký lại cùng email không tạo thêm mã, không lộ email nào đã có trong danh sách. Trả về { welcome }: có gửi quà hay không.
export async function subscribe(email) {
  let sub = await prisma.subscriber.findUnique({ where: { email } })
  if (!sub) sub = await prisma.subscriber.create({ data: { email } })
  else if (sub.unsubscribedAt) sub = await prisma.subscriber.update({ where: { id: sub.id }, data: { unsubscribedAt: null } })

  if (sub.welcomeCode) return { welcome: false }
  const coupon = await createWelcomeCoupon()
  if (!coupon) return { welcome: false }
  await prisma.subscriber.update({ where: { id: sub.id }, data: { welcomeCode: coupon.code } })
  // Gửi nền: email chậm hoặc lỗi không làm khách chờ / thấy lỗi.
  welcomeEmail(sub, coupon).then((m) => sendMail({ to: sub.email, ...m })).catch(() => {})
  return { welcome: true }
}

export async function unsubscribe(token) {
  const r = await prisma.subscriber.updateMany({ where: { unsubToken: token, unsubscribedAt: null }, data: { unsubscribedAt: new Date() } })
  const exists = r.count > 0 || (await prisma.subscriber.count({ where: { unsubToken: token } })) > 0
  return exists
}

let running = null // id đợt đang gửi (chỉ cho gửi một đợt một lúc)
export const sendingBlastId = () => running
const GAP_MS = 400 // nghỉ giữa hai email để không bị nhà cung cấp SMTP chặn vì gửi dồn dập

// Bắt đầu một đợt gửi tới mọi người đang đăng ký; trả về bản ghi ngay, việc gửi chạy nền.
export async function startBlast({ subject, body, createdBy }) {
  if (running) {
    const err = new Error('Đang có một đợt gửi chạy, vui lòng đợi hoàn tất.')
    err.status = 409
    throw err
  }
  const total = await prisma.subscriber.count({ where: { unsubscribedAt: null } })
  if (total === 0) {
    const err = new Error('Chưa có ai đang đăng ký nhận email.')
    err.status = 400
    throw err
  }
  const blast = await prisma.emailBlast.create({ data: { subject, body, total, createdBy } })
  running = blast.id
  runBlast(blast).finally(() => {
    running = null
  })
  return blast
}

async function runBlast(blast) {
  let sent = 0
  let failed = 0
  try {
    let cursor
    for (;;) {
      const batch = await prisma.subscriber.findMany({
        where: { unsubscribedAt: null },
        orderBy: { id: 'asc' },
        take: 50,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      })
      if (!batch.length) break
      for (const sub of batch) {
        const m = await blastEmail(blast.subject, blast.body, sub)
        if (await sendMail({ to: sub.email, ...m })) sent++
        else failed++
        await new Promise((r) => setTimeout(r, GAP_MS))
      }
      cursor = batch[batch.length - 1].id
      await prisma.emailBlast.update({ where: { id: blast.id }, data: { sent, failed } })
    }
  } catch (err) {
    console.error('Gửi chiến dịch email lỗi:', err.message)
  } finally {
    await prisma.emailBlast.update({ where: { id: blast.id }, data: { sent, failed, status: 'DONE', finishedAt: new Date() } }).catch(() => {})
  }
}

// Gửi thử một email mẫu (nội dung như thật) tới một địa chỉ để xem trước khi gửi hàng loạt.
export async function sendTest({ to, subject, body }) {
  const fake = { unsubToken: 'xem-thu', email: to }
  const m = await blastEmail(subject, body, fake)
  return sendMail({ to, ...m })
}
