import { prisma } from '../lib/prisma.js'
import { toPlain } from '../utils/serialize.js'
import { generateOrderNumber } from '../utils/ids.js'
import { getStorefrontProduct, reserveStock, loadProducts, StockError } from '../lib/productStore.js'
import { getSettings, shippingFeeFor, COD_METHOD_ID } from '../lib/settingsStore.js'
import { quoteShipping, chooseShipping } from '../lib/shippingRates.js'
import { sendMail } from '../lib/mailer.js'
import { PAYOS_METHOD_ID, payosConfigured, createPaymentLink } from '../lib/payos.js'
import { displayCode, findOrderByCode, normCode } from '../lib/orderCode.js'
import { orderWeightGrams } from '../lib/weight.js'
import { checkCoupon, redeemCoupon, CouponError } from '../lib/coupons.js'
import { scanPack, packQueue, workload } from '../lib/fulfillment.js'
import { DELIVERY_TYPES, classifyDelivery, deliveryTypeOf } from '../lib/deliveryType.js'
import { orderCreatedEmail } from '../lib/emailTemplates.js'
import { ORDER_INCLUDE, OPEN_STATUSES, FlowError, applyTransition, advanceToProcessing, approveCancel, rejectCancel, approveReturn, rejectReturn, handleDueAt, canRequestReturn, listReviewsAdmin } from '../lib/orderFlow.js'
import { invalidateUser } from '../lib/authCache.js'
import { INACTIVE_SHIPMENT } from '../constants/workflow.js'

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


const ORDER_STATUSES = ['PENDING_CONFIRMATION', 'CONFIRMED', 'PROCESSING', 'AWAITING_SHIPMENT', 'SHIPPING', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'RETURNED']

export async function listOrders(req, res) {
  const {
    search = '',
    status,
    paymentStatus,
    paymentMethod,
    carrierId,
    dateFrom,
    dateTo,
    needsAction,
    deliveryType,
    refund,
    page = '1',
    pageSize = '10',
  } = req.query

  const where = {}
  const and = []

  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: 'insensitive' } },
      { shipment: { carrierCode: { contains: search, mode: 'insensitive' } } },
      { recipientName: { contains: search, mode: 'insensitive' } },
      { recipientPhone: { contains: search } },
      { customer: { name: { contains: search, mode: 'insensitive' } } },
      { customer: { phone: { contains: search } } },
    ]
  }
  // "Cần xử lý": đơn nhân viên còn việc (COD hoặc đã thanh toán, chưa bàn giao vận chuyển) hoặc khách đang chờ phản hồi yêu cầu hủy/trả hàng.
  if (needsAction === '1') {
    and.push({
      OR: [
        { status: { in: OPEN_STATUSES }, OR: [{ paymentMethod: COD_METHOD_ID }, { paymentStatus: 'PAID' }] },
        { cancelRequestedAt: { not: null } },
        { returnRequest: { status: 'REQUESTED' } },
      ],
    })
  }
  if (refund === '1') and.push({ paymentStatus: 'PAID', status: { in: ['CANCELLED', 'RETURNED'] } }) // đơn đã hủy / trả hàng chờ hoàn tiền
  if (and.length) where.AND = and
  if (DELIVERY_TYPES.includes(deliveryType)) where.deliveryType = deliveryType
  if (status) {
    // Một trạng thái, hoặc nhiều trạng thái cách nhau bằng dấu phẩy (tab "Chờ lấy hàng" gồm Đã xác nhận + Đang xử lý + Chờ giao hàng...).
    const list = String(status).split(',').filter((v) => ORDER_STATUSES.includes(v))
    if (list.length === 1) where.status = list[0]
    else if (list.length > 1) where.status = { in: list }
  }
  if (paymentStatus) where.paymentStatus = paymentStatus
  if (paymentMethod) where.paymentMethod = paymentMethod
  if (carrierId) where.shipment = { carrierId }
  if (dateFrom || dateTo) {
    where.createdAt = {}
    if (dateFrom) where.createdAt.gte = new Date(dateFrom)
    if (dateTo) where.createdAt.lte = new Date(dateTo)
  }

  const settings = await getSettings()
  const rules = settings.orders
  const take = Math.max(1, Math.min(100, Number(pageSize) || 10))
  const skip = (Math.max(1, Number(page) || 1) - 1) * take
  const include = {
    customer: true,
    items: true,
    shipment: { include: { carrier: true } },
    returnRequest: { select: { status: true } },
  }
  const view = (o) => {
    const type = deliveryTypeOf(o, settings)
    // Hãng chưa lấy hàng quá pickupAlertHours giờ kể từ lúc tạo vận đơn (nhắc nhân viên liên hệ hãng).
    const waiting = o.shipment?.status === 'AWAITING_PICKUP'
    const pickupOverdue = !!(waiting && rules.pickupAlertHours && Date.now() - new Date(o.shipment.createdAt).getTime() > rules.pickupAlertHours * 3600000)
    return toPlain({ ...o, code: displayCode(o), deliveryType: type, handleDueAt: handleDueAt(o, rules, type), pickupOverdue })
  }

  if (needsAction === '1') {
    // Mỗi loại đơn (hỏa tốc / nội thành / liên tỉnh) có hạn xử lý khác nhau nên xếp theo HẠN (gần quá hạn nhất lên đầu), không theo ngày đặt:
    // lấy các đơn cần xử lý (giới hạn 500), sắp xếp và phân trang trong bộ nhớ.
    const all = await prisma.order.findMany({ where, include, orderBy: { createdAt: 'asc' }, take: 500 })
    const dueMs = (o) => handleDueAt(o, rules, deliveryTypeOf(o, settings))?.getTime() ?? Number.MAX_SAFE_INTEGER
    all.sort((a, b) => dueMs(a) - dueMs(b) || a.createdAt - b.createdAt)
    return res.json({ items: all.slice(skip, skip + take).map(view), total: all.length, page: Number(page) || 1, pageSize: take })
  }

  const [items, total] = await Promise.all([
    prisma.order.findMany({ where, include, orderBy: { createdAt: 'desc' }, take, skip }),
    prisma.order.count({ where }),
  ])

  res.json({ items: items.map(view), total, page: Number(page) || 1, pageSize: take })
}

// Số đơn theo từng trạng thái trong một truy vấn (trang Tổng quan trước đây gọi riêng từng trạng thái).
export async function orderStatusCounts(req, res) {
  const groups = await prisma.order.groupBy({ by: ['status'], _count: { _all: true } })
  res.json(Object.fromEntries(groups.map((g) => [g.status, g._count._all])))
}

// Các trường tính thêm khi trả đơn cho nhân viên: mã hiển thị, loại giao hàng và hạn xử lý theo loại.
async function orderExtras(order) {
  const settings = await getSettings()
  const type = deliveryTypeOf(order, settings)
  const hours = settings.orders.cancelAutoApproveHours
  return {
    code: displayCode(order),
    deliveryType: type,
    handleDueAt: handleDueAt(order, settings.orders, type),
    cancelAutoApproveAt: order.cancelRequestedAt && hours && !(order.shipment && !INACTIVE_SHIPMENT.includes(order.shipment.status)) ? new Date(new Date(order.cancelRequestedAt).getTime() + hours * 3600000) : null,
  }
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
    ...(await orderExtras(order)),
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
    shippingRateId,
    couponCode,
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
  const tax = 0
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0)
  // Phí vận chuyển do server quyết định: báo giá Goship chạy được thì khách phải chọn đúng một lựa chọn còn hiệu lực, không thì phí cố định.
  const quote = await quoteShipping({ settings, address: { province, district, ward }, subtotal, cod: paymentMethod === COD_METHOD_ID ? subtotal : 0, weightGrams: orderWeightGrams(lines, settings.shipping.goship.defaultWeightGrams) })
  const shipping = chooseShipping(settings, subtotal, quote, shippingRateId)
  if (shipping.error) {
    return res.status(409).json({ error: 'Cước vận chuyển đã thay đổi hoặc chưa chọn đơn vị vận chuyển, vui lòng chọn lại.', code: 'SHIPPING_CHANGED' })
  }
  const shippingFee = shipping.fee

  const dbCustomer = await resolveOrderCustomer(req.user, customer)

  // Mã giảm giá: kiểm tra lại toàn bộ điều kiện ở server (khách có thể gửi mã cũ / hết hạn), số tiền giảm do server tính.
  let coupon = null
  let discount = 0
  if (couponCode) {
    try {
      const checked = await checkCoupon(couponCode, subtotal, { customerId: dbCustomer.id })
      coupon = checked.coupon
      discount = checked.discount
    } catch (err) {
      if (err instanceof CouponError) return res.status(400).json({ error: err.message, code: 'COUPON_INVALID' })
      throw err
    }
  }
  const total = subtotal - discount + shippingFee + tax

  let campaignId = null
  if (utmCampaign) {
    const campaign = await prisma.campaign.findUnique({ where: { utmCode: utmCampaign } })
    if (campaign) campaignId = campaign.id
  }

  // Mã đơn ngẫu nhiên có thể (rất hiếm) trùng một đơn khác: thử lại với mã mới, giao dịch cũ đã tự hoàn tác (kể cả tồn kho).
  const placeOrder = () =>
    prisma.$transaction(async (tx) => {
      // Trừ tồn kho và tạo đơn trong cùng một giao dịch: hết hàng giữa chừng thì không tạo đơn.
      const reserved = await reserveStock(tx, lines)
      const created = await tx.order.create({
        data: {
          stockReserved: reserved,
          deliveryType: shipping.express ? 'EXPRESS' : classifyDelivery({ province, service: shipping.service }, settings),
          shippingService: shipping.service || null,
          shippingCarrier: shipping.carrier || null,
          orderNumber: generateOrderNumber(),
          customerId: dbCustomer.id,
          paymentMethod,
          subtotal,
          discount,
          couponCode: coupon?.code || null,
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
          statusEvents: { create: { status: 'PENDING_CONFIRMATION', note: shipping.label ? `Đơn hàng được tạo · Vận chuyển: ${shipping.label}` : 'Đơn hàng được tạo' } },
        },
        include: ORDER_INCLUDE,
      })
      if (coupon) await redeemCoupon(tx, coupon, { orderId: created.id, customerId: dbCustomer.id, amount: discount })
      return created
    }, { timeout: 15000, maxWait: 10000 })

  let order
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        order = await placeOrder()
        break
      } catch (err) {
        const clash = err?.code === 'P2002' && String(err.meta?.target ?? '').includes('orderNumber')
        if (!clash || attempt >= 4) throw err
      }
    }
  } catch (err) {
    if (err instanceof StockError) return res.status(400).json({ error: err.message })
    if (err instanceof CouponError) return res.status(400).json({ error: err.message, code: 'COUPON_INVALID' })
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

export const normPhone = (p) => {
  const d = String(p || '').replace(/\D/g, '')
  return d.startsWith('84') ? `0${d.slice(2)}` : d
}

// Khách đã đăng nhập: đơn gắn vào hồ sơ của tài khoản để hiện trong trang Tài khoản. Số điện thoại trong form thanh toán có thể
// khác (mua tặng) nên không dùng nó để chọn hồ sơ. Chưa có hồ sơ thì tạo mới và gắn vào tài khoản, nhưng KHÔNG gắn vào hồ sơ có
// sẵn của số điện thoại đó (chưa xác minh chủ số thì không được cho xem lịch sử đơn của người khác).
async function resolveOrderCustomer(user, customer) {
  // Hồ sơ đã có theo số điện thoại: giữ nguyên tên/email đã lưu (người đặt chưa chứng minh là chủ số, không được ghi đè).
  // Chỉ điền email khi hồ sơ chưa có và email đó chưa thuộc hồ sơ khác (email là duy nhất).
  const byPhone = async () => {
    const existing = await prisma.customer.findUnique({ where: { phone: customer.phone } })
    const emailTaken = customer.email && (await prisma.customer.findUnique({ where: { email: customer.email } }))
    const email = emailTaken ? undefined : customer.email
    if (!existing) return prisma.customer.create({ data: { name: customer.name, phone: customer.phone, email } })
    if (!existing.email && email) return prisma.customer.update({ where: { id: existing.id }, data: { email } })
    return existing
  }
  if (user?.role !== 'CUSTOMER') return byPhone()
  if (user.customerId) {
    const own = await prisma.customer.findUnique({ where: { id: user.customerId } })
    if (own) return own
  }
  const existing = await prisma.customer.findUnique({ where: { phone: customer.phone } })
  if (existing) return byPhone()
  // Email của hồ sơ là duy nhất: đã có hồ sơ khác dùng thì bỏ qua email thay vì làm hỏng đơn.
  const emailTaken = customer.email && (await prisma.customer.findUnique({ where: { email: customer.email } }))
  const created = await prisma.customer.create({
    data: { name: customer.name, phone: customer.phone, email: emailTaken ? undefined : customer.email },
  })
  await prisma.user.update({ where: { id: user.id }, data: { customerId: created.id } })
  invalidateUser(user.id)
  return created
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

const flowFail = (res, err) => res.status(err.status || 400).json({ error: err.message, ...(err.code ? { code: err.code } : {}) })

// Chạy một thao tác vòng đời đơn của nhân viên: lỗi nghiệp vụ trả 4xx tiếng Việt, đơn sau khi xử lý trả về kèm hạn xử lý.
async function adminAction(req, res, run) {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: ORDER_INCLUDE })
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' })
  try {
    const updated = await run(order)
    res.json(toPlain({ ...updated, ...(await orderExtras(updated)) }))
  } catch (err) {
    if (err instanceof FlowError) return flowFail(res, err)
    throw err
  }
}

const actorOf = (req) => req.user?.username || req.user?.email || 'admin'

function transitionOrderStatus(req, res, { to, note }) {
  return adminAction(req, res, (order) => applyTransition(order, { to, note, actor: actorOf(req) }))
}

// Quét mã vạch trên tem để xác nhận đã đóng gói; hàng đợi đóng gói; khối lượng việc và giờ chốt đơn hôm nay.
export async function scanPackOrder(req, res) {
  try {
    res.json(await scanPack(req.body.code, actorOf(req)))
  } catch (err) {
    if (err instanceof FlowError) return flowFail(res, err)
    throw err
  }
}
export const packQueueOrders = async (req, res) => res.json(await packQueue())
export const ordersWorkload = async (req, res) => {
  res.set('Cache-Control', 'no-store')
  const [w, reviewsToReply, refundsPending] = await Promise.all([
    workload(),
    prisma.review.count({ where: { hidden: false, reply: null } }),
    prisma.order.count({ where: { paymentStatus: 'PAID', status: { in: ['CANCELLED', 'RETURNED'] } } }), // đơn đã hủy / trả hàng mà tiền khách chưa hoàn
  ])
  res.json({ ...w, reviewsToReply, refundsPending })
}

// Nút "Chuẩn bị hàng": xác nhận (nếu cần) và chuyển đơn sang Đang xử lý để tạo vận đơn / in tem.
export const prepareOrder = (req, res) => adminAction(req, res, (order) => advanceToProcessing(order, actorOf(req)))

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
      data: {
        paymentStatus: 'REFUNDED',
        refundedAt: new Date(),
        // Đã hoàn xong: che số tài khoản của khách, chỉ giữ 4 số cuối để đối chiếu.
        ...(order.refundAccountNumber && { refundAccountNumber: `${'*'.repeat(Math.max(0, order.refundAccountNumber.length - 4))}${order.refundAccountNumber.slice(-4)}` }),
      },
      include: ORDER_INCLUDE,
    })
    await tx.activityLog.create({
      data: { entityType: 'order', orderId: order.id, action: 'refund', actor: 'admin', note },
    })
    return u
  })

  res.json(toPlain(updated))
}

// Nhân viên nhập / sửa tài khoản nhận hoàn tiền của khách (khi khách chưa tự nhập, hoặc nhập sai). Chỉ khi đơn đã thanh toán và chưa hoàn.
export async function setRefundInfo(req, res) {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } })
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' })
  if (order.paymentStatus !== 'PAID') return res.status(400).json({ error: 'Chỉ nhập tài khoản hoàn tiền cho đơn đã thanh toán và chưa hoàn.' })
  const b = req.body
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { refundBankBin: b.bankBin, refundBankName: b.bankName, refundAccountNumber: b.accountNumber, refundAccountName: b.accountName },
    include: ORDER_INCLUDE,
  })
  await prisma.activityLog.create({ data: { entityType: 'order', orderId: order.id, action: 'refund_info', actor: actorOf(req), note: 'Nhập / sửa tài khoản nhận hoàn tiền' } })
  res.json(toPlain(updated))
}

// Nhân viên duyệt / từ chối yêu cầu của khách (hủy đơn, trả hàng).
export const approveCancelRequest = (req, res) => adminAction(req, res, (o) => approveCancel(o, { note: req.body?.note, actor: actorOf(req) }))
export const rejectCancelRequest = (req, res) => adminAction(req, res, (o) => rejectCancel(o, { note: req.body.note, actor: actorOf(req) }))
export const approveReturnRequest = (req, res) => adminAction(req, res, (o) => approveReturn(o, { note: req.body?.note, faultParty: req.body?.faultParty, actor: actorOf(req) }))
export const rejectReturnRequest = (req, res) => adminAction(req, res, (o) => rejectReturn(o, { note: req.body.note, actor: actorOf(req) }))

// Hoạt động gần đây (xác nhận, hủy, đóng gói, đánh giá...) của các đơn, mới nhất trước, cho khối "Hoạt động gần đây" ở trang Tổng quan.
export async function recentActivity(req, res) {
  const take = Math.min(30, Math.max(1, Number(req.query.limit) || 8))
  const rows = await prisma.activityLog.findMany({
    where: { orderId: { not: null } },
    orderBy: { createdAt: 'desc' },
    take,
    select: { id: true, action: true, actor: true, note: true, createdAt: true, order: { select: { id: true, orderNumber: true } } },
  })
  res.set('Cache-Control', 'no-store')
  res.json({ items: rows })
}

// Nhân viên xem tất cả đánh giá (lọc theo sao / trạng thái / từ khóa).
export async function listReviews(req, res) {
  const { rating, status, q, page, pageSize } = req.query
  res.json(await listReviewsAdmin({ rating: Number(rating) || undefined, status, q, page: Number(page) || 1, pageSize: Number(pageSize) || 20 }))
}

// Nhân viên trả lời đánh giá của khách (hiện công khai dưới đánh giá); gửi chuỗi rỗng để xóa phản hồi.
export async function replyReview(req, res) {
  const reply = req.body.reply
  const r = await prisma.review.updateMany({ where: { id: req.params.reviewId }, data: { reply: reply || null, repliedAt: reply ? new Date() : null } })
  if (!r.count) return res.status(404).json({ error: 'Không tìm thấy đánh giá.' })
  res.json({ ok: true })
}

// Nhân viên ẩn / hiện đánh giá không phù hợp của một đơn.
export async function setReviewHidden(req, res) {
  const r = await prisma.review.updateMany({ where: { id: req.params.reviewId }, data: { hidden: req.body.hidden } })
  if (!r.count) return res.status(404).json({ error: 'Không tìm thấy đánh giá.' })
  res.json({ ok: true })
}

// Chuyển nhiều đơn sang "Đã xác nhận" / "Đang xử lý" cùng lúc. Mỗi đơn xử lý độc lập: đơn nào không hợp lệ thì báo riêng, không chặn các đơn khác.
export async function bulkOrderStatus(req, res) {
  const { ids, status } = req.body
  const orders = await prisma.order.findMany({ where: { id: { in: ids } }, include: ORDER_INCLUDE })
  const byId = new Map(orders.map((o) => [o.id, o]))
  const results = []
  for (const id of ids) {
    const order = byId.get(id)
    if (!order) { results.push({ id, ok: false, error: 'Không tìm thấy đơn hàng.' }); continue }
    try {
      await applyTransition(order, { to: status, note: status === 'CONFIRMED' ? 'Xác nhận đơn hàng' : 'Chuẩn bị hàng', actor: actorOf(req) })
      results.push({ id, orderNumber: order.orderNumber, ok: true })
    } catch (err) {
      if (!(err instanceof FlowError)) throw err
      results.push({ id, orderNumber: order.orderNumber, ok: false, error: err.message })
    }
  }
  res.json({ results, done: results.filter((r) => r.ok).length })
}

// --- Khách tự tra cứu đơn (công khai) ------------------------------------------------------------
// Cần cả mã đơn lẫn số điện thoại đặt hàng; sai một trong hai đều trả cùng một thông báo để không dò được mã đơn.
// Chỉ trả những gì khách cần xem: không có ghi chú nội bộ, nhật ký hoạt động hay thông tin khách khác.

// Dạng đơn hàng gửi cho khách (tra cứu công khai và trang tài khoản): không có ghi chú nội bộ, nhật ký hoạt động.
export const PUBLIC_ORDER_INCLUDE = {
  customer: true,
  items: { include: { review: true } },
  returnRequest: true,
  statusEvents: { orderBy: { createdAt: 'asc' } },
  shipment: { include: { carrier: true, trackingEvents: { orderBy: { createdAt: 'asc' } } } },
}

const cancelAction = (order) => {
  if (!['PENDING_CONFIRMATION', 'CONFIRMED', 'PROCESSING', 'AWAITING_SHIPMENT'].includes(order.status)) return null
  if (!order.shipment || INACTIVE_SHIPMENT.includes(order.shipment.status)) return 'now'
  return order.shipment.status === 'AWAITING_PICKUP' && !order.cancelRequestedAt ? 'request' : null
}

// Che tên người nhận: chỉ chữ cái đầu mỗi từ ("Nguyễn Văn A" -> "N*** V*** A***").
const maskName = (name) => String(name || '').split(/\s+/).filter(Boolean).map((w) => `${w[0]}***`).join(' ')

// masked = khách chỉ cung cấp MỘT trong hai thông tin (mã đơn hoặc số điện thoại): ẩn tên và địa chỉ nhận hàng chi tiết, chỉ giữ tỉnh/thành.
export function publicOrderView(order, { masked = false, canReturn = false, deliveryType = null, cancelAutoApproveHours = 0 } = {}) {
  // Việc khách làm được với đơn này. Chỉ khi đã xác thực bằng số điện thoại (không phải bản che thông tin).
  const actions = masked
    ? {}
    : {
        // Chưa có vận đơn: khách hủy ngay. Có vận đơn còn chờ hãng lấy hàng: chỉ gửi yêu cầu, nhân viên duyệt. Hãng đã lấy hàng: không hủy được (cancelBlocked để giao diện báo lý do).
        cancel: cancelAction(order),
        cancelBlocked: cancelAction(order) === null && ['PENDING_CONFIRMATION', 'CONFIRMED', 'PROCESSING', 'AWAITING_SHIPMENT'].includes(order.status) && Boolean(order.shipment && !INACTIVE_SHIPMENT.includes(order.shipment.status)) && !order.cancelRequestedAt,
        received: order.status === 'DELIVERED' && !order.receivedAt,
        return: canReturn,
        review: ['DELIVERED', 'COMPLETED'].includes(order.status) && order.items.some((i) => i.productId && !i.review),
      }
  return toPlain({
    actions,
    receivedAt: order.receivedAt,
    deliveryType,
    cancelRequest: {
      pending: !!order.cancelRequestedAt,
      reason: order.cancelRequestReason,
      rejectedNote: order.cancelRejectedNote,
      // Quá giờ này mà shop chưa phản hồi thì yêu cầu hủy tự được đồng ý.
      autoApproveAt: order.cancelRequestedAt && cancelAutoApproveHours && !(order.shipment && !INACTIVE_SHIPMENT.includes(order.shipment.status)) ? new Date(new Date(order.cancelRequestedAt).getTime() + cancelAutoApproveHours * 3600000) : null,
    },
    returnRequest: order.returnRequest && { status: order.returnRequest.status, reason: order.returnRequest.reason, adminNote: order.returnRequest.adminNote, createdAt: order.returnRequest.createdAt },
    orderNumber: order.orderNumber,
    code: displayCode(order), // mã vận đơn của hãng nếu có, không thì mã đơn
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    createdAt: order.createdAt,
    subtotal: order.subtotal,
    shippingFee: order.shippingFee,
    discount: order.discount,
    total: order.total,
    masked,
    recipientName: masked ? maskName(order.recipientName) : order.recipientName,
    addressLine: masked ? null : order.addressLine,
    ward: masked ? null : order.ward,
    district: masked ? null : order.district,
    province: order.province,
    items: order.items.map((i) => ({
      id: i.id,
      review: i.review && { rating: i.review.rating, comment: i.review.comment },
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
      carrierCode: order.shipment.carrierCode,
      status: order.shipment.status,
      events: order.shipment.trackingEvents.map((t) => ({ status: t.status, note: t.note, location: t.location, createdAt: t.createdAt })),
    },
  })
}

// Đơn dạng khách xem, kèm việc khách làm được (hủy / đã nhận / trả hàng / đánh giá) theo quy tắc trong Cài đặt.
export async function customerView(order, { masked = false } = {}) {
  const settings = await getSettings()
  const rules = settings.orders
  return publicOrderView(order, { masked, canReturn: masked ? false : await canRequestReturn(order, rules), deliveryType: deliveryTypeOf(order, settings), cancelAutoApproveHours: rules.cancelAutoApproveHours })
}

// Tra cứu bằng mã đơn HOẶC số điện thoại (hoặc cả hai):
//  - cả hai: trả đầy đủ thông tin giao hàng như trước;
//  - chỉ mã đơn: trả đơn đó nhưng ẩn tên/địa chỉ nhận hàng (mã đơn chỉ có 5 chữ số nên không được coi là bí mật);
//  - chỉ số điện thoại: trả danh sách đơn gần đây (mã, ngày, trạng thái, tổng tiền, tên sản phẩm), không kèm thông tin giao hàng.
export async function trackOrder(req, res) {
  const orderNumber = normCode(req.query.orderNumber) // mã đơn ORD-xxxxx hoặc mã vận đơn của hãng
  const phone = normPhone(req.query.phone)
  const hasPhone = phone.length >= 8
  const notFound = () => res.status(404).json({ error: 'Không tìm thấy đơn hàng với thông tin này.' })
  const matchesPhone = (o) => [o.recipientPhone, o.customer?.phone].some((p) => normPhone(p) === phone)
  res.set('Cache-Control', 'no-store')

  if (orderNumber) {
    const order = await findOrderByCode(orderNumber, { include: PUBLIC_ORDER_INCLUDE })
    if (!order) return notFound()
    if (hasPhone) {
      if (!matchesPhone(order)) return notFound()
      return res.json(await customerView(order))
    }
    if (req.query.phone) return notFound() // có nhập số điện thoại nhưng quá ngắn: không coi như bỏ trống
    return res.json(await customerView(order, { masked: true }))
  }

  if (!hasPhone) return notFound()
  // Số điện thoại trong database có thể có dấu cách/chấm/+84: so khớp 8 chữ số cuối sau khi bỏ ký tự không phải số, rồi lọc lại chính xác bằng normPhone.
  const tail = phone.slice(-8)
  const ids = await prisma.$queryRaw`
    SELECT o."id" FROM "Order" o LEFT JOIN "Customer" c ON c."id" = o."customerId"
    WHERE right(regexp_replace(o."recipientPhone", '\D', '', 'g'), 8) = ${tail}
       OR right(regexp_replace(c."phone", '\D', '', 'g'), 8) = ${tail}
    ORDER BY o."createdAt" DESC LIMIT 50`
  const found = ids.length
    ? await prisma.order.findMany({ where: { id: { in: ids.map((r) => r.id) } }, include: { customer: true, items: true, shipment: true }, orderBy: { createdAt: 'desc' } })
    : []
  const mine = found.filter(matchesPhone).slice(0, 20)
  if (!mine.length) return notFound()
  res.json({
    orders: mine.map((o) => toPlain({
        orderNumber: o.orderNumber,
        code: displayCode(o),
        status: o.status,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt,
        total: o.total,
        items: o.items.map((i) => ({ name: i.name, variant: i.variant, quantity: i.quantity })),
      })),
  })
}

// Báo giá vận chuyển cho trang thanh toán: { mode: 'goship', options } hoặc { mode: 'fixed', fee } (dùng phí cố định trong Cài đặt).
export async function shippingQuote(req, res) {
  const { items, paymentMethod, province, district, ward } = req.body
  const lines = []
  for (const it of items) {
    const { line, error } = priceLine(it)
    if (error) return res.status(400).json({ error })
    lines.push(line)
  }
  const settings = await getSettings()
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0)
  const quote = await quoteShipping({ settings, address: { province, district, ward }, subtotal, cod: paymentMethod === COD_METHOD_ID ? subtotal : 0, weightGrams: orderWeightGrams(lines, settings.shipping.goship.defaultWeightGrams) })
  res.set('Cache-Control', 'no-store')
  if (quote.status === 'ok') return res.json({ mode: 'goship', options: quote.options })
  res.json({ mode: 'fixed', fee: shippingFeeFor(settings, subtotal), reason: quote.status })
}
