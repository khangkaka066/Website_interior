import { prisma } from '../lib/prisma.js'
import { toPlain } from '../utils/serialize.js'
import { generateOrderNumber } from '../utils/ids.js'
import { canTransitionOrder } from '../constants/workflow.js'
import { getStorefrontProduct, reserveStock, releaseStock, loadProducts, StockError } from '../lib/productStore.js'
import { getSettings, shippingFeeFor } from '../lib/settingsStore.js'
import { sendMail } from '../lib/mailer.js'
import { PAYOS_METHOD_ID, payosConfigured, createPaymentLink } from '../lib/payos.js'
import { orderCreatedEmail, orderStatusEmail, NOTIFY_STATUSES } from '../lib/emailTemplates.js'

// Đơn công khai: giá, phí ship, giảm giá do server quyết định, không tin client.
const MAX_LINE_QTY = 999

// Trả về dòng hàng đã tra giá từ danh mục, hoặc { error }.
function priceLine(it) {
  const product = getStorefrontProduct(it?.productId)
  if (!product) return { error: 'Có sản phẩm không tồn tại trong cửa hàng.' }

  const quantity = Number(it.quantity)
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QTY) {
    return { error: `Số lượng không hợp lệ cho "${product.name}".` }
  }

  let unitPrice = product.price
  let variant = null
  if (product.variants?.length) {
    variant = product.variants.find((v) => v.label === it.variant)
    if (!variant) return { error: `Vui lòng chọn phân loại hợp lệ cho "${product.name}".` }
    if (variant.stock <= 0) return { error: `"${product.name}" (${variant.label}) đã hết hàng.` }
    unitPrice = variant.price
  }

  return {
    line: {
      productId: product.id,
      name: product.name,
      sku: null,
      variant: variant?.label || null,
      image: product.image || null,
      quantity,
      unitPrice,
      discount: 0,
      lineTotal: unitPrice * quantity,
    },
  }
}

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

  if (items.length > 100) return res.status(400).json({ error: 'Đơn hàng có quá nhiều sản phẩm.' })
  const lines = []
  for (const it of items) {
    const { line, error } = priceLine(it)
    if (error) return res.status(400).json({ error })
    lines.push(line)
  }
  const settings = await getSettings()
  const method =
    settings.payment.methods.find((m) => m.id === paymentMethod && m.enabled) ||
    (paymentMethod === PAYOS_METHOD_ID && payosConfigured() ? { id: PAYOS_METHOD_ID } : null)
  if (!method) return res.status(400).json({ error: 'Phương thức thanh toán này hiện không khả dụng.' })
  const discount = 0
  const tax = 0
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0)
  const shippingFee = shippingFeeFor(settings, subtotal)
  const total = subtotal - discount + shippingFee + tax

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

  let order
  try {
    order = await prisma.$transaction(async (tx) => {
      // Trừ tồn kho và tạo đơn trong cùng một giao dịch: hết hàng giữa chừng thì không tạo đơn.
      const reserved = await reserveStock(tx, lines)
      return tx.order.create({
        data: {
          stockReserved: reserved,
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
            create: lines,
          },
          statusEvents: { create: { status: 'PENDING_CONFIRMATION', note: 'Đơn hàng được tạo' } },
        },
        include: ORDER_INCLUDE,
      })
    }, { timeout: 15000, maxWait: 10000 })
  } catch (err) {
    if (err instanceof StockError) return res.status(400).json({ error: err.message })
    throw err
  }
  await loadProducts() // website thấy số lượng còn lại ngay
  // Email xác nhận cho khách (nếu có email). Chạy nền, lỗi email không ảnh hưởng đơn hàng.
  if (order.customer?.email) orderCreatedEmail(order).then((m) => sendMail({ to: order.customer.email, ...m }))

  const body = toPlain(order)
  // Thanh toán online: kèm link để trình duyệt chuyển khách sang trang thanh toán. Tạo link lỗi thì đơn vẫn giữ,
  // khách thanh toán lại được ở trang Tra cứu đơn hàng.
  if (paymentMethod === PAYOS_METHOD_ID) {
    try {
      body.paymentUrl = await createPaymentLink(order)
    } catch (err) {
      console.error('Tạo link PayOS cho', order.orderNumber, 'lỗi:', err.message)
    }
  }
  res.status(201).json(body)
}

const normPhone = (p) => {
  const d = String(p || '').replace(/\D/g, '')
  return d.startsWith('84') ? `0${d.slice(2)}` : d
}

// Khách tạo lại link thanh toán PayOS cho đơn chưa trả tiền (link cũ hết hạn hoặc lỗi). Cần mã đơn + số điện thoại.
export async function payosRelink(req, res) {
  const orderNumber = String(req.body.orderNumber || '').trim().toUpperCase()
  const phone = normPhone(req.body.phone)
  const order = await prisma.order.findUnique({ where: { orderNumber }, include: { customer: true } })
  if (!order || ![order.recipientPhone, order.customer?.phone].some((p) => normPhone(p) === phone)) {
    return res.status(404).json({ error: 'Không tìm thấy đơn hàng với mã đơn và số điện thoại này.' })
  }
  if (order.paymentMethod !== PAYOS_METHOD_ID || order.paymentStatus !== 'AWAITING_PAYMENT' || ['CANCELLED', 'RETURNED'].includes(order.status)) {
    return res.status(400).json({ error: 'Đơn hàng này không cần thanh toán online.' })
  }
  if (!payosConfigured()) return res.status(503).json({ error: 'Thanh toán online hiện chưa khả dụng.' })
  try {
    res.json({ paymentUrl: await createPaymentLink(order) })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}

async function transitionOrderStatus(req, res, { to, note, actor = 'admin' }) {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } })
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' })

  if (!canTransitionOrder(order.status, to)) {
    return res.status(400).json({
      error: `Không thể chuyển trạng thái từ "${order.status}" sang "${to}".`,
    })
  }

  let released = false
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.order.update({
      where: { id: order.id },
      data: {
        status: to,
        statusEvents: { create: { status: to, note } },
      },
      include: ORDER_INCLUDE,
    })
    // Hủy đơn hoặc khách trả hàng: cộng lại tồn kho (chỉ khi đơn này đã trừ kho).
    if ((to === 'CANCELLED' || to === 'RETURNED') && order.stockReserved) {
      const items = await tx.orderItem.findMany({ where: { orderId: order.id } })
      await releaseStock(tx, items.map((i) => ({ productId: i.productId, variant: i.variant, quantity: i.quantity })))
      await tx.order.update({ where: { id: order.id }, data: { stockReserved: false } })
      released = true
    }
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

  if (released) await loadProducts()
  if (NOTIFY_STATUSES.includes(to) && updated.customer?.email) {
    orderStatusEmail(updated, to).then((m) => m && sendMail({ to: updated.customer.email, ...m }))
  }
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

// --- Khách tự tra cứu đơn (công khai) ------------------------------------------------------------
// Cần cả mã đơn lẫn số điện thoại đặt hàng; sai một trong hai đều trả cùng một thông báo để không dò được mã đơn.
// Chỉ trả những gì khách cần xem: không có ghi chú nội bộ, nhật ký hoạt động hay thông tin khách khác.

export async function trackOrder(req, res) {
  const orderNumber = String(req.query.orderNumber || '').trim().toUpperCase()
  const phone = normPhone(req.query.phone)
  const notFound = () => res.status(404).json({ error: 'Không tìm thấy đơn hàng với mã đơn và số điện thoại này.' })
  if (!orderNumber || phone.length < 8) return notFound()

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      customer: true,
      items: true,
      statusEvents: { orderBy: { createdAt: 'asc' } },
      shipment: { include: { carrier: true, trackingEvents: { orderBy: { createdAt: 'asc' } } } },
    },
  })
  if (!order || ![order.recipientPhone, order.customer?.phone].some((p) => normPhone(p) === phone)) return notFound()

  res.set('Cache-Control', 'no-store')
  res.json(
    toPlain({
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt,
      subtotal: order.subtotal,
      shippingFee: order.shippingFee,
      discount: order.discount,
      total: order.total,
      recipientName: order.recipientName,
      addressLine: order.addressLine,
      ward: order.ward,
      district: order.district,
      province: order.province,
      items: order.items.map((i) => ({
        productId: i.productId,
        name: i.name,
        variant: i.variant,
        image: i.image,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        lineTotal: i.lineTotal,
      })),
      statusEvents: order.statusEvents.map((e) => ({ status: e.status, createdAt: e.createdAt })),
      shipment: order.shipment && {
        carrier: order.shipment.carrier?.name,
        trackingId: order.shipment.trackingId,
        status: order.shipment.status,
        events: order.shipment.trackingEvents.map((t) => ({ status: t.status, note: t.note, location: t.location, createdAt: t.createdAt })),
      },
    }),
  )
}
