import crypto from 'crypto'
import { prisma } from '../lib/prisma.js'
import { hashPassword, comparePassword, signToken, publicUser } from '../lib/auth.js'

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

// Customer convenience login via a Google profile — no password, so we
// find-or-create a CUSTOMER account keyed by the Google email and issue a
// normal session token for it (matches the rest of the site's auth model
// instead of being a separate client-only stub).
export async function googleLogin(req, res) {
  const { name, email } = req.body || {}
  if (!name || !email) return res.status(400).json({ error: 'Thiếu thông tin hồ sơ Google.' })

  let user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        name,
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
