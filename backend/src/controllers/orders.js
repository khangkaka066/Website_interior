import { prisma } from '../lib/prisma.js'
import { toPlain } from '../utils/serialize.js'
import { generateOrderNumber } from '../utils/ids.js'
import { canTransitionOrder } from '../constants/workflow.js'

const ORDER_INCLUDE = {
  customer: true,
  items: true,
  statusEvents: { orderBy: { createdAt: 'asc' } },
  shipment: { include: { carrier: true, trackingEvents: { orderBy: { createdAt: 'asc' } } } },
  activityLogs: { orderBy: { createdAt: 'desc' } },
}

export async function listOrders(req, res) {
  const {
    search = '',
    status,
    paymentStatus,
    paymentMethod,
    carrierId,
    dateFrom,
    dateTo,
    page = '1',
    pageSize = '10',
  } = req.query

  const where = {}

  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: 'insensitive' } },
      { recipientName: { contains: search, mode: 'insensitive' } },
      { recipientPhone: { contains: search } },
      { customer: { name: { contains: search, mode: 'insensitive' } } },
      { customer: { phone: { contains: search } } },
    ]
  }
  if (status) where.status = status
  if (paymentStatus) where.paymentStatus = paymentStatus
  if (paymentMethod) where.paymentMethod = paymentMethod
  if (carrierId) where.shipment = { carrierId }
  if (dateFrom || dateTo) {
    where.createdAt = {}
    if (dateFrom) where.createdAt.gte = new Date(dateFrom)
    if (dateTo) where.createdAt.lte = new Date(dateTo)
  }

  const take = Math.max(1, Math.min(100, Number(pageSize) || 10))
  const skip = (Math.max(1, Number(page) || 1) - 1) * take

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        customer: true,
        items: true,
        shipment: { include: { carrier: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.order.count({ where }),
  ])

  res.json({
    items: items.map(toPlain),
    total,
    page: Number(page) || 1,
    pageSize: take,
  })
}

export async function getOrder(req, res) {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: ORDER_INCLUDE,
  })
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' })

  const [previousOrderCount, totalSpentAgg] = await Promise.all([
    prisma.order.count({
      where: { customerId: order.customerId, id: { not: order.id } },
    }),
    prisma.order.aggregate({
      where: { customerId: order.customerId, status: { not: 'CANCELLED' } },
      _sum: { total: true },
    }),
  ])

  res.json({
    ...toPlain(order),
    customer: {
      ...toPlain(order.customer),
      previousOrderCount,
      totalSpent: toPlain(totalSpentAgg._sum.total) || 0,
    },
  })
}

export async function createOrder(req, res) {
  const {
    customer,
    items,
    paymentMethod,
    discount = 0,
    shippingFee = 0,
    tax = 0,
    recipientName,
    recipientPhone,
    addressLine,
    ward,
    district,
    province,
    utmSource,
    utmMedium,
    utmCampaign,
  } = req.body || {}

  if (!customer?.name || !customer?.phone) {
    return res.status(400).json({ error: 'Thiếu thông tin khách hàng.' })
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Đơn hàng cần ít nhất một sản phẩm.' })
  }
  if (!paymentMethod || !recipientName || !recipientPhone || !addressLine || !province) {
    return res.status(400).json({ error: 'Thiếu thông tin giao hàng.' })
  }

  const subtotal = items.reduce((sum, it) => sum + it.unitPrice * it.quantity - (it.discount || 0), 0)
  const total = subtotal - Number(discount) + Number(shippingFee) + Number(tax)

  const dbCustomer = await prisma.customer.upsert({
    where: { phone: customer.phone },
    update: { name: customer.name, email: customer.email },
    create: { name: customer.name, phone: customer.phone, email: customer.email },
  })

  let campaignId = null
  if (utmCampaign) {
    const campaign = await prisma.campaign.findUnique({ where: { utmCode: utmCampaign } })
    if (campaign) campaignId = campaign.id
  }

  const order = await prisma.order.create({
    data: {
      orderNumber: generateOrderNumber(),
      customerId: dbCustomer.id,
      paymentMethod,
      subtotal,
      discount,
      shippingFee,
      tax,
      total,
      recipientName,
      recipientPhone,
      addressLine,
      ward,
      district,
      province,
      campaignId,
      utmSource: utmSource || null,
      utmMedium: utmMedium || null,
      utmCampaign: utmCampaign || null,
      items: {
        create: items.map((it) => ({
          productId: it.productId || null,
          name: it.name,
          sku: it.sku || null,
          variant: it.variant || null,
          image: it.image || null,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discount: it.discount || 0,
          lineTotal: it.unitPrice * it.quantity - (it.discount || 0),
        })),
      },
      statusEvents: { create: { status: 'PENDING_CONFIRMATION', note: 'Đơn hàng được tạo' } },
    },
    include: ORDER_INCLUDE,
  })

  res.status(201).json(toPlain(order))
}

async function transitionOrderStatus(req, res, { to, note, actor = 'admin' }) {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } })
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' })

  if (!canTransitionOrder(order.status, to)) {
    return res.status(400).json({
      error: `Không thể chuyển trạng thái từ "${order.status}" sang "${to}".`,
    })
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.order.update({
      where: { id: order.id },
      data: {
        status: to,
        statusEvents: { create: { status: to, note } },
      },
      include: ORDER_INCLUDE,
    })
    await tx.activityLog.create({
      data: {
        entityType: 'order',
        orderId: order.id,
        action: `status_${to.toLowerCase()}`,
        actor,
        note,
      },
    })
    return u
  })

  res.json(toPlain(updated))
}

export async function updateOrderStatus(req, res) {
  const { status, note } = req.body || {}
  if (!status) return res.status(400).json({ error: 'Thiếu trạng thái mới.' })
  return transitionOrderStatus(req, res, { to: status, note })
}

export async function confirmOrder(req, res) {
  return transitionOrderStatus(req, res, { to: 'CONFIRMED', note: req.body?.note || 'Xác nhận đơn hàng' })
}

export async function cancelOrder(req, res) {
  const { note } = req.body || {}
  if (!note) return res.status(400).json({ error: 'Vui lòng nhập lý do hủy đơn.' })
  return transitionOrderStatus(req, res, { to: 'CANCELLED', note })
}

export async function refundOrder(req, res) {
  const { note } = req.body || {}
  const order = await prisma.order.findUnique({ where: { id: req.params.id } })
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' })
  if (order.paymentStatus !== 'PAID') {
    return res.status(400).json({ error: 'Chỉ có thể hoàn tiền đơn đã thanh toán.' })
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.order.update({
      where: { id: order.id },
      data: { paymentStatus: 'REFUNDED' },
      include: ORDER_INCLUDE,
    })
    await tx.activityLog.create({
      data: { entityType: 'order', orderId: order.id, action: 'refund', actor: 'admin', note },
    })
    return u
  })

  res.json(toPlain(updated))
}
