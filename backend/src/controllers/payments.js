import { prisma } from '../lib/prisma.js'
import { toPlain } from '../utils/serialize.js'
import { webhookStatus } from '../lib/paymentWebhook.js'

const PAYMENT_STATUSES = ['AWAITING_PAYMENT', 'PAID', 'FAILED', 'REFUNDED']
const SELECT = {
  id: true,
  orderNumber: true,
  createdAt: true,
  status: true,
  paymentStatus: true,
  paymentMethod: true,
  transactionId: true,
  total: true,
  recipientName: true,
  recipientPhone: true,
  customer: { select: { name: true, phone: true } },
}

export async function listPayments(req, res) {
  const { search = '', status, method, dateFrom, dateTo } = req.query
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 10))
  const where = {}
  if (PAYMENT_STATUSES.includes(status)) where.paymentStatus = status
  if (method) where.paymentMethod = String(method)
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: 'insensitive' } },
      { transactionId: { contains: search, mode: 'insensitive' } },
      { recipientName: { contains: search, mode: 'insensitive' } },
      { recipientPhone: { contains: search } },
    ]
  }
  if (dateFrom || dateTo) {
    where.createdAt = {}
    if (dateFrom) where.createdAt.gte = new Date(dateFrom)
    if (dateTo) where.createdAt.lte = new Date(new Date(dateTo).getTime() + 24 * 3600 * 1000 - 1)
  }
  const [items, total] = await Promise.all([
    prisma.order.findMany({ where, select: SELECT, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.order.count({ where }),
  ])
  res.json({ items: toPlain(items), total, page, pageSize })
}

export async function paymentSummary(req, res) {
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000)
  const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000)
  const [byStatus, paidByMethod, codDeliveredUnpaid, transferOverdue, cancelledPaid, unmatchedCount, mismatchCount] = await Promise.all([
    // đơn đã hủy mà chưa thu tiền thì không tính vào "chờ thanh toán"
    prisma.order.groupBy({
      by: ['paymentStatus'],
      where: { NOT: { status: { in: ['CANCELLED', 'RETURNED'] }, paymentStatus: 'AWAITING_PAYMENT' } },
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.order.groupBy({ by: ['paymentMethod'], where: { paymentStatus: 'PAID' }, _count: { _all: true }, _sum: { total: true } }),
    prisma.order.count({ where: { paymentMethod: 'COD', status: 'DELIVERED', paymentStatus: 'AWAITING_PAYMENT' } }),
    prisma.order.count({
      where: { paymentMethod: { not: 'COD' }, paymentStatus: 'AWAITING_PAYMENT', status: { notIn: ['CANCELLED', 'RETURNED'] }, createdAt: { lt: dayAgo } },
    }),
    prisma.order.count({ where: { status: { in: ['CANCELLED', 'RETURNED'] }, paymentStatus: 'PAID' } }),
    prisma.activityLog.count({ where: { action: 'payment_unmatched', createdAt: { gte: monthAgo } } }),
    prisma.order.count({
      where: { paymentStatus: { in: ['AWAITING_PAYMENT', 'FAILED'] }, status: { notIn: ['CANCELLED', 'RETURNED'] }, activityLogs: { some: { action: 'payment_mismatch' } } },
    }),
  ])
  const statuses = Object.fromEntries(PAYMENT_STATUSES.map((s) => [s, { count: 0, amount: 0 }]))
  for (const r of toPlain(byStatus)) statuses[r.paymentStatus] = { count: r._count._all, amount: Number(r._sum.total || 0) }
  res.json({
    statuses,
    paidByMethod: toPlain(paidByMethod).map((r) => ({ method: r.paymentMethod, count: r._count._all, amount: Number(r._sum.total || 0) })),
    alerts: { codDeliveredUnpaid, transferOverdue, cancelledPaid, unmatchedCount, mismatchCount },
    webhooks: webhookStatus(),
  })
}

// Tiền đã về tài khoản nhưng không khớp đơn nào (sai/thiếu mã đơn, đơn đã hủy, chuyển trùng...): để admin xử lý tay.
export async function listUnmatched(req, res) {
  const items = await prisma.activityLog.findMany({
    where: { action: 'payment_unmatched' },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, createdAt: true, actor: true, note: true },
  })
  res.json({ items: toPlain(items) })
}

async function transition(req, res, { from, to, action, requireNote, message }) {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, select: { id: true, status: true, paymentStatus: true, transactionId: true } })
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' })
  if (!from.includes(order.paymentStatus)) return res.status(400).json({ error: message })
  if (to === 'PAID' && ['CANCELLED', 'RETURNED'].includes(order.status)) {
    return res.status(400).json({ error: 'Đơn đã hủy hoặc trả hàng, không thể xác nhận thanh toán.' })
  }
  const { transactionId, note } = req.body || {}
  const logNote = [transactionId && `Mã GD: ${transactionId}`, note].filter(Boolean).join(' · ') || null
  if (requireNote && !note) return res.status(400).json({ error: 'Vui lòng nhập lý do.' })
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.order.update({
      where: { id: order.id },
      data: { paymentStatus: to, ...(to === 'PAID' && transactionId ? { transactionId } : {}) },
      select: SELECT,
    })
    await tx.activityLog.create({
      data: { entityType: 'order', orderId: order.id, action, actor: req.user?.email || 'admin', note: logNote },
    })
    return u
  })
  res.json(toPlain(updated))
}

export const confirmPayment = (req, res) =>
  transition(req, res, { from: ['AWAITING_PAYMENT', 'FAILED'], to: 'PAID', action: 'confirm_payment', message: 'Đơn này đã được thanh toán hoặc hoàn tiền rồi.' })
export const failPayment = (req, res) =>
  transition(req, res, { from: ['AWAITING_PAYMENT'], to: 'FAILED', action: 'payment_failed', requireNote: true, message: 'Chỉ đánh dấu thất bại được với đơn đang chờ thanh toán.' })
export const refundPayment = (req, res) =>
  transition(req, res, { from: ['PAID'], to: 'REFUNDED', action: 'refund', requireNote: true, message: 'Chỉ hoàn tiền được với đơn đã thanh toán.' })
