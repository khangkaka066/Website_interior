import { prisma } from '../lib/prisma.js'
import { toPlain } from '../utils/serialize.js'
import { generateTrackingId } from '../utils/ids.js'
import { canTransitionShipping, SHIPPING_TO_ORDER_STATUS } from '../constants/workflow.js'

const SHIPMENT_INCLUDE = {
  carrier: true,
  order: { include: { customer: true } },
  trackingEvents: { orderBy: { createdAt: 'asc' } },
}

const STATUS_LABEL = {
  NOT_CREATED: 'Đã tạo vận đơn',
  AWAITING_PICKUP: 'Chờ lấy hàng',
  PICKED_UP: 'Đã lấy hàng',
  IN_TRANSIT: 'Đang trung chuyển',
  OUT_FOR_DELIVERY: 'Đang giao',
  DELIVERED: 'Giao thành công',
  FAILED: 'Giao thất bại',
  RETURNING: 'Đang hoàn',
  RETURNED: 'Đã hoàn',
}

export async function getShippingDashboard(req, res) {
  const [
    awaitingShipment,
    inTransit,
    deliveredToday,
    failed,
    returning,
    deliveredShipments,
    totalShipments,
  ] = await Promise.all([
    prisma.order.count({ where: { status: 'AWAITING_SHIPMENT' } }),
    prisma.shipment.count({ where: { status: { in: ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'] } } }),
    prisma.shipment.count({
      where: { status: 'DELIVERED', updatedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    }),
    prisma.shipment.count({ where: { status: 'FAILED' } }),
    prisma.shipment.count({ where: { status: { in: ['RETURNING', 'RETURNED'] } } }),
    prisma.shipment.findMany({
      where: { status: 'DELIVERED' },
      select: { createdAt: true, updatedAt: true },
    }),
    prisma.shipment.count(),
  ])

  const avgDeliveryMs =
    deliveredShipments.length > 0
      ? deliveredShipments.reduce((sum, s) => sum + (s.updatedAt - s.createdAt), 0) / deliveredShipments.length
      : 0
  const avgDeliveryDays = avgDeliveryMs / (1000 * 60 * 60 * 24)
  const successRate = totalShipments > 0 ? (deliveredShipments.length / totalShipments) * 100 : 0

  res.json({
    awaitingShipment,
    inTransit,
    deliveredToday,
    failed,
    returning,
    avgDeliveryDays: Number(avgDeliveryDays.toFixed(1)),
    successRate: Number(successRate.toFixed(1)),
  })
}

export async function getShippingAlerts(req, res) {
  const [notCreated, failed, awaitingPickup, returning] = await Promise.all([
    prisma.order.count({ where: { status: 'AWAITING_SHIPMENT', shipment: null } }),
    prisma.shipment.count({ where: { status: 'FAILED' } }),
    prisma.shipment.count({ where: { status: 'AWAITING_PICKUP' } }),
    prisma.shipment.count({ where: { status: 'RETURNING' } }),
  ])

  const alerts = []
  if (notCreated > 0) alerts.push({ key: 'not_created', count: notCreated, message: `${notCreated} đơn chưa tạo vận đơn`, filter: { status: 'AWAITING_SHIPMENT' } })
  if (failed > 0) alerts.push({ key: 'failed', count: failed, message: `${failed} đơn giao thất bại`, filter: { status: 'FAILED' } })
  if (awaitingPickup > 0) alerts.push({ key: 'awaiting_pickup', count: awaitingPickup, message: `${awaitingPickup} đơn đang chờ lấy hàng`, filter: { status: 'AWAITING_PICKUP' } })
  if (returning > 0) alerts.push({ key: 'returning', count: returning, message: `${returning} đơn đang yêu cầu hoàn hàng`, filter: { status: 'RETURNING' } })

  res.json({ alerts })
}

export async function listShipments(req, res) {
  const { search = '', status, carrierId, dateFrom, dateTo, page = '1', pageSize = '10' } = req.query

  const where = {}
  if (search) {
    where.OR = [
      { trackingId: { contains: search, mode: 'insensitive' } },
      { recipientName: { contains: search, mode: 'insensitive' } },
      { order: { orderNumber: { contains: search, mode: 'insensitive' } } },
    ]
  }
  if (status) where.status = status
  if (carrierId) where.carrierId = carrierId
  if (dateFrom || dateTo) {
    where.createdAt = {}
    if (dateFrom) where.createdAt.gte = new Date(dateFrom)
    if (dateTo) where.createdAt.lte = new Date(dateTo)
  }

  const take = Math.max(1, Math.min(100, Number(pageSize) || 10))
  const skip = (Math.max(1, Number(page) || 1) - 1) * take

  const [items, total] = await Promise.all([
    prisma.shipment.findMany({
      where,
      include: { carrier: true, order: { select: { orderNumber: true } } },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.shipment.count({ where }),
  ])

  res.json({ items: items.map(toPlain), total, page: Number(page) || 1, pageSize: take })
}

export async function getShipment(req, res) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: req.params.id },
    include: SHIPMENT_INCLUDE,
  })
  if (!shipment) return res.status(404).json({ error: 'Không tìm thấy vận đơn.' })
  res.json(toPlain(shipment))
}

export async function createShipment(req, res) {
  const {
    orderId,
    carrierId,
    senderName,
    weightGrams,
    lengthCm,
    widthCm,
    heightCm,
    goodsType,
    shippingFee,
    codAmount = 0,
    note,
  } = req.body || {}

  if (!orderId || !carrierId || !senderName || !weightGrams || !shippingFee) {
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc để tạo vận đơn.' })
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' })

  if (!['PROCESSING', 'AWAITING_SHIPMENT'].includes(order.status)) {
    return res.status(400).json({
      error: `Đơn hàng đang ở trạng thái "${order.status}", cần xử lý xong trước khi tạo vận đơn.`,
    })
  }

  const existing = await prisma.shipment.findUnique({ where: { orderId } })
  if (existing) return res.status(400).json({ error: 'Đơn hàng này đã có vận đơn.' })

  const carrier = await prisma.shippingCarrier.findUnique({ where: { id: carrierId } })
  if (!carrier) return res.status(404).json({ error: 'Không tìm thấy đơn vị vận chuyển.' })

  const shipment = await prisma.$transaction(async (tx) => {
    const created = await tx.shipment.create({
      data: {
        trackingId: generateTrackingId(carrier.code),
        orderId: order.id,
        carrierId: carrier.id,
        status: 'AWAITING_PICKUP',
        senderName,
        recipientName: order.recipientName,
        recipientPhone: order.recipientPhone,
        addressLine: order.addressLine,
        ward: order.ward,
        district: order.district,
        province: order.province,
        weightGrams,
        lengthCm,
        widthCm,
        heightCm,
        goodsType,
        shippingFee,
        codAmount,
        note,
        trackingEvents: {
          create: { status: STATUS_LABEL.AWAITING_PICKUP, note: 'Đã tạo vận đơn, chờ đơn vị vận chuyển lấy hàng' },
        },
      },
    })

    if (order.status !== 'AWAITING_SHIPMENT' && order.status !== 'SHIPPING') {
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'AWAITING_SHIPMENT', statusEvents: { create: { status: 'AWAITING_SHIPMENT', note: 'Đã tạo vận đơn' } } },
      })
    }

    await tx.activityLog.create({
      data: { entityType: 'shipment', shipmentId: created.id, orderId: order.id, action: 'create_shipment', actor: 'admin' },
    })

    // Re-read with the full include after the order status update above, so
    // the response's nested `order` reflects its final status.
    return tx.shipment.findUniqueOrThrow({ where: { id: created.id }, include: SHIPMENT_INCLUDE })
  })

  res.status(201).json(toPlain(shipment))
}

export async function updateShipmentStatus(req, res) {
  const { status, location, note } = req.body || {}
  if (!status) return res.status(400).json({ error: 'Thiếu trạng thái mới.' })

  const shipment = await prisma.shipment.findUnique({ where: { id: req.params.id } })
  if (!shipment) return res.status(404).json({ error: 'Không tìm thấy vận đơn.' })

  if (!canTransitionShipping(shipment.status, status)) {
    return res.status(400).json({ error: `Không thể chuyển trạng thái từ "${shipment.status}" sang "${status}".` })
  }

  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        status,
        trackingEvents: { create: { status: STATUS_LABEL[status] || status, location, note } },
      },
    })

    const mappedOrderStatus = SHIPPING_TO_ORDER_STATUS[status]
    if (mappedOrderStatus) {
      await tx.order.update({
        where: { id: shipment.orderId },
        data: {
          status: mappedOrderStatus,
          statusEvents: { create: { status: mappedOrderStatus, note: `Cập nhật từ vận chuyển: ${STATUS_LABEL[status] || status}` } },
        },
      })
    }

    await tx.activityLog.create({
      data: {
        entityType: 'shipment',
        shipmentId: shipment.id,
        orderId: shipment.orderId,
        action: `status_${status.toLowerCase()}`,
        actor: 'admin',
        note,
      },
    })

    // Re-read with the full include after the order status cascade above, so
    // the response's nested `order` reflects its final status.
    return tx.shipment.findUniqueOrThrow({ where: { id: s.id }, include: SHIPMENT_INCLUDE })
  })

  res.json(toPlain(updated))
}

export async function cancelShipment(req, res) {
  const { note } = req.body || {}
  const shipment = await prisma.shipment.findUnique({ where: { id: req.params.id } })
  if (!shipment) return res.status(404).json({ error: 'Không tìm thấy vận đơn.' })
  if (['DELIVERED', 'RETURNED'].includes(shipment.status)) {
    return res.status(400).json({ error: 'Không thể hủy vận đơn đã hoàn tất.' })
  }

  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        status: 'NOT_CREATED',
        trackingEvents: { create: { status: 'Đã hủy vận đơn', note } },
      },
      include: SHIPMENT_INCLUDE,
    })
    await tx.activityLog.create({
      data: { entityType: 'shipment', shipmentId: shipment.id, orderId: shipment.orderId, action: 'cancel_shipment', actor: 'admin', note },
    })
    return s
  })

  res.json(toPlain(updated))
}
