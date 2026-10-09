import crypto from 'crypto'
import { OAuth2Client } from 'google-auth-library'
import { prisma } from '../lib/prisma.js'
import { hashPassword, comparePassword, signToken, publicUser } from '../lib/auth.js'
import { sendMail } from '../lib/mailer.js'
import { passwordResetEmail } from '../lib/emailTemplates.js'
import { invalidateUser } from '../lib/authCache.js'

export async function register(req, res) {
  const { name, email, password, phone } = req.body || {}
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ họ tên, email và mật khẩu.' })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Email không hợp lệ.' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu cần ít nhất 6 ký tự.' })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return res.status(400).json({ error: 'Email này đã được đăng ký.' })

  let customer = null
  if (phone) {
    customer = await prisma.customer.upsert({
      where: { phone },
      update: { name, email },
      create: { name, phone, email },
    })
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      role: 'CUSTOMER',
      customerId: customer?.id,
    },
  })

  res.status(201).json({ token: signToken(user), user: publicUser(user) })
}

export async function login(req, res) {
  const { email, password } = req.body || {}
  if (!email || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập email/tên đăng nhập và mật khẩu.' })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !(await comparePassword(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu.' })
  }

  res.json({ token: signToken(user), user: publicUser(user) })
}

// Đăng nhập bằng Google: client gửi ID token (credential) của Google Identity Services, server TỰ xác minh chữ ký, đối tượng (aud)
// và email đã xác minh. Tuyệt đối không tin tên/email do client gửi lên. Cần GOOGLE_CLIENT_ID (cùng giá trị với VITE_GOOGLE_CLIENT_ID).
let googleClient = null
export async function googleLogin(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) return res.status(503).json({ error: 'Đăng nhập bằng Google hiện chưa được kích hoạt.' })

  let payload
  try {
    googleClient ||= new OAuth2Client(clientId)
    const ticket = await googleClient.verifyIdToken({ idToken: req.body.credential, audience: clientId })
    payload = ticket.getPayload()
  } catch {
    return res.status(401).json({ error: 'Không xác minh được tài khoản Google, vui lòng thử lại.' })
  }
  if (!payload?.email || !payload.email_verified) {
    return res.status(401).json({ error: 'Email Google chưa được xác minh.' })
  }

  const email = payload.email.toLowerCase()
  let user = await prisma.user.findUnique({ where: { email } })
  // Tài khoản quản trị chỉ đăng nhập bằng mật khẩu: không để đường Google mở cửa vào trang quản trị.
  if (user?.role === 'ADMIN') {
    return res.status(403).json({ error: 'Tài khoản quản trị vui lòng đăng nhập bằng email và mật khẩu.' })
  }
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: (payload.name || email.split('@')[0]).slice(0, 100),
        email,
        passwordHash: await hashPassword(crypto.randomBytes(24).toString('hex')),
        role: 'CUSTOMER',
      },
    })
  }
  res.json({ token: signToken(user), user: publicUser(user) })
}

export async function me(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Vui lòng đăng nhập.' })
  res.json({ user: publicUser(req.user) })
}

// --- Quên mật khẩu ------------------------------------------------------------------------------
const RESET_TTL_MS = 60 * 60 * 1000
const MAX_ACTIVE_RESETS = 3 // tối đa 3 yêu cầu còn hiệu lực cho một tài khoản (chặn spam email)
const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex')

// Luôn trả cùng một câu trả lời dù email có tồn tại hay không, để không dò được ai đã đăng ký.
export async function forgotPassword(req, res) {
  const generic = { ok: true, message: 'Nếu email này có tài khoản, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.' }
  const email = String(req.body.email || '').trim()
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !email.includes('@')) return res.json(generic)

  const active = await prisma.passwordResetToken.count({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
  })
  if (active >= MAX_ACTIVE_RESETS) return res.json(generic)

  const token = crypto.randomBytes(32).toString('hex')
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
  })
  // Không chờ gửi email xong mới trả lời (cũng tránh để thời gian phản hồi lộ email có tồn tại hay không).
  passwordResetEmail(user.name, token).then((mail) => sendMail({ to: user.email, ...mail }))
  res.json(generic)
}

export async function resetPassword(req, res) {
  const { token, password } = req.body
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } })
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return res.status(400).json({ error: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.' })
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash: await hashPassword(password) } }),
    prisma.passwordResetToken.updateMany({ where: { userId: record.userId, usedAt: null }, data: { usedAt: new Date() } }),
  ])
  invalidateUser(record.userId)
  res.json({ ok: true, message: 'Đã đặt lại mật khẩu. Bạn có thể đăng nhập bằng mật khẩu mới.' })
}
