import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { requirePermission } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { prisma } from '../lib/prisma.js'
import { couponSchema, couponPatchSchema } from '../schemas/coupons.js'

// Quản lý mã giảm giá (Marketing): cùng nhóm quyền với Giảm giá theo mã.
const router = Router()
router.use(requirePermission('products'))

const toDate = (v) => (v ? new Date(v) : null)
const data = (b) => ({
  ...b,
  ...('startsAt' in b && { startsAt: toDate(b.startsAt) }),
  ...('endsAt' in b && { endsAt: toDate(b.endsAt) }),
  ...('description' in b && { description: b.description || null }),
  ...(b.type === 'FIXED' && { maxDiscount: null }), // giảm cố định không có mức tối đa
})
const dup = (err, res) => {
  if (err?.code === 'P2002') return res.status(409).json({ error: 'Mã này đã tồn tại.' })
  throw err
}

router.get('/', asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json({ items: await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } }) })
}))

router.post('/', validate(couponSchema), asyncHandler(async (req, res) => {
  try {
    res.status(201).json(await prisma.coupon.create({ data: data(req.body) }))
  } catch (err) {
    dup(err, res)
  }
}))

router.patch('/:id', validate(couponPatchSchema), asyncHandler(async (req, res) => {
  try {
    res.json(await prisma.coupon.update({ where: { id: req.params.id }, data: data(req.body) }))
  } catch (err) {
    if (err?.code === 'P2025') return res.status(404).json({ error: 'Không tìm thấy mã giảm giá.' })
    dup(err, res)
  }
}))

// Mã đã có người dùng thì không xóa (giữ lịch sử đơn hàng): chỉ tắt.
router.delete('/:id', asyncHandler(async (req, res) => {
  const c = await prisma.coupon.findUnique({ where: { id: req.params.id } })
  if (!c) return res.status(404).json({ error: 'Không tìm thấy mã giảm giá.' })
  if (c.usedCount > 0) return res.status(409).json({ error: 'Mã đã có đơn sử dụng, không xóa được. Hãy tắt mã thay vì xóa.' })
  await prisma.coupon.delete({ where: { id: c.id } })
  res.json({ ok: true })
}))

export default router
