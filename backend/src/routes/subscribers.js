import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { requirePermission } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { prisma } from '../lib/prisma.js'
import { getSettings, saveSettings } from '../lib/settingsStore.js'
import { mailConfigured } from '../lib/mailer.js'
import { startBlast, sendTest, sendingBlastId } from '../lib/subscribers.js'
import { blastSchema, blastTestSchema, welcomeConfigSchema } from '../schemas/subscribers.js'

// Quản lý email đăng ký + quà chào mừng + chiến dịch email (Marketing): cùng nhóm quyền với Quảng cáo.
const router = Router()
router.use(requirePermission('campaigns'))

const PAGE = 20

router.get('/', asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const q = String(req.query.q || '').trim()
  const status = req.query.status
  const where = {
    ...(q && { email: { contains: q, mode: 'insensitive' } }),
    ...(status === 'active' && { unsubscribedAt: null }),
    ...(status === 'unsubscribed' && { unsubscribedAt: { not: null } }),
  }
  const [total, items, active, all, settings] = await Promise.all([
    prisma.subscriber.count({ where }),
    prisma.subscriber.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * PAGE, take: PAGE, select: { id: true, email: true, createdAt: true, unsubscribedAt: true, welcomeCode: true } }),
    prisma.subscriber.count({ where: { unsubscribedAt: null } }),
    prisma.subscriber.count(),
    getSettings(),
  ])
  res.set('Cache-Control', 'no-store')
  res.json({ items, total, page, pageSize: PAGE, stats: { active, unsubscribed: all - active, all }, mailConfigured: mailConfigured(), welcome: settings.marketing })
}))

// Toàn bộ người đang đăng ký (để xuất file CSV).
router.get('/export', asyncHandler(async (req, res) => {
  const items = await prisma.subscriber.findMany({ where: { unsubscribedAt: null }, orderBy: { createdAt: 'asc' }, select: { email: true, createdAt: true }, take: 100000 })
  res.set('Cache-Control', 'no-store')
  res.json({ items })
}))

router.put('/welcome', validate(welcomeConfigSchema), asyncHandler(async (req, res) => {
  const next = await saveSettings({ marketing: req.body })
  res.json(next.marketing)
}))

router.get('/blasts', asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json({ items: await prisma.emailBlast.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }), sendingId: sendingBlastId() })
}))

router.post('/blasts/test', validate(blastTestSchema), asyncHandler(async (req, res) => {
  const ok = await sendTest(req.body)
  if (!ok) return res.status(502).json({ error: mailConfigured() ? 'Không gửi được email thử, kiểm tra lại cấu hình SMTP.' : 'Chưa cấu hình SMTP trên máy chủ nên không gửi được email (nội dung đã in ra log máy chủ).' })
  res.json({ ok: true })
}))

router.post('/blasts', validate(blastSchema), asyncHandler(async (req, res) => {
  if (!mailConfigured()) return res.status(400).json({ error: 'Chưa cấu hình SMTP trên máy chủ (SMTP_HOST...), chưa thể gửi email hàng loạt.' })
  try {
    res.status(201).json(await startBlast({ ...req.body, createdBy: req.user?.email || req.user?.username || null }))
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    throw err
  }
}))

router.delete('/:id', asyncHandler(async (req, res) => {
  const r = await prisma.subscriber.deleteMany({ where: { id: req.params.id } })
  if (!r.count) return res.status(404).json({ error: 'Không tìm thấy email.' })
  res.json({ ok: true })
}))

export default router
