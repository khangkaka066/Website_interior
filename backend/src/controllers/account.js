import { prisma } from '../lib/prisma.js'
import { hashPassword, comparePassword, publicUser } from '../lib/auth.js'
import { toPlain } from '../utils/serialize.js'
import { PUBLIC_ORDER_INCLUDE, publicOrderView, normPhone } from './orders.js'

// Trang "Tài khoản của tôi": chỉ tài khoản khách (CUSTOMER) và chỉ dữ liệu của chính họ. Mọi truy vấn đều lọc theo
// customerId của người đang đăng nhập, không nhận customerId từ client.
const MAX_ADDRESSES = 10

const profileOf = (user, customer) => ({
  ...publicUser(user),
  phone: customer?.phone || null,
  dob: customer?.dob ? customer.dob.toISOString().slice(0, 10) : null,
  gender: customer?.gender || null,
})

async function loadCustomer(user) {
  return user.customerId ? prisma.customer.findUnique({ where: { id: user.customerId } }) : null
}

export function requireCustomer(req, res, next) {
  if (req.user?.role !== 'CUSTOMER') return res.status(403).json({ error: 'Chỉ tài khoản khách hàng mới dùng được mục này.' })
  next()
}

export async function getProfile(req, res) {
  res.json(profileOf(req.user, await loadCustomer(req.user)))
}

export async function updateProfile(req, res) {
  const { name, phone, dob, gender } = req.body
  const customer = await loadCustomer(req.user)
  const data = { name, ...(dob !== undefined && { dob: dob ? new Date(dob) : null }), ...(gender !== undefined && { gender }) }

  let saved = customer
  if (customer) {
    if (phone && phone !== customer.phone) {
      if (await prisma.customer.findUnique({ where: { phone } })) {
        return res.status(409).json({ error: 'Số điện thoại này đã được dùng cho một hồ sơ khác.' })
      }
      data.phone = phone
    }
    saved = await prisma.customer.update({ where: { id: customer.id }, data })
  } else if (phone) {
    // Chưa có hồ sơ khách: tạo mới và gắn vào tài khoản. Số điện thoại đã có hồ sơ thì không gắn (chưa xác minh chủ số);
    // khách dùng "Liên kết đơn hàng" với mã đơn + số điện thoại để nhận lại đơn cũ.
    if (await prisma.customer.findUnique({ where: { phone } })) {
      return res.status(409).json({
        error: 'Số điện thoại này đã từng đặt hàng. Hãy dùng "Liên kết đơn hàng" bằng mã đơn và số điện thoại để nhận lại đơn cũ.',
      })
    }
    saved = await prisma.customer.create({ data: { ...data, phone } })
  }

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { name, ...(saved && !customer && { customerId: saved.id }) },
  })
  res.json(profileOf(user, saved))
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body
  if (!(await comparePassword(currentPassword, req.user.passwordHash))) {
    return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng.' })
  }
  await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash: await hashPassword(newPassword) } })
  res.json({ ok: true, message: 'Đã đổi mật khẩu.' })
}

// --- Đơn hàng ------------------------------------------------------------------------------------
export async function listMyOrders(req, res) {
  if (!req.user.customerId) return res.json([])
  const orders = await prisma.order.findMany({
    where: { customerId: req.user.customerId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { items: true },
  })
  res.json(
    toPlain(
      orders.map((o) => ({
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        total: o.total,
        createdAt: o.createdAt,
        items: o.items.map((i) => ({ name: i.name, variant: i.variant, image: i.image, quantity: i.quantity })),
      })),
    ),
  )
}

export async function getMyOrder(req, res) {
  const order = req.user.customerId
    ? await prisma.order.findFirst({
        where: { orderNumber: String(req.params.orderNumber).toUpperCase(), customerId: req.user.customerId },
        include: PUBLIC_ORDER_INCLUDE,
      })
    : null
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' })
  res.set('Cache-Control', 'no-store')
  res.json(publicOrderView(order))
}

// Nhận lại đơn đã đặt khi chưa đăng nhập: chứng minh bằng đúng mã đơn + số điện thoại (như trang Tra cứu đơn hàng).
export async function claimOrder(req, res) {
  const orderNumber = req.body.orderNumber.toUpperCase()
  const phoneIn = normPhone(req.body.phone)
  const notFound = () => res.status(404).json({ error: 'Không tìm thấy đơn hàng với mã đơn và số điện thoại này.' })

  const order = await prisma.order.findUnique({ where: { orderNumber }, include: { customer: { include: { account: true } } } })
  if (!order || ![order.recipientPhone, order.customer?.phone].some((p) => normPhone(p) === phoneIn)) return notFound()
  if (order.customerId === req.user.customerId) return res.json({ ok: true, orderNumber })

  if (req.user.customerId) {
    // Đã có hồ sơ: chuyển riêng đơn này sang hồ sơ của mình, trừ khi đơn đang thuộc về tài khoản khác.
    if (order.customer?.account && order.customer.account.id !== req.user.id) {
      return res.status(409).json({ error: 'Đơn hàng này đã được liên kết với một tài khoản khác.' })
    }
    await prisma.order.update({ where: { id: order.id }, data: { customerId: req.user.customerId } })
  } else {
    // Chưa có hồ sơ: nhận luôn hồ sơ khách của đơn (nếu chưa thuộc tài khoản nào), nên các đơn cùng số điện thoại cũng hiện ra.
    if (order.customer?.account) return res.status(409).json({ error: 'Đơn hàng này đã được liên kết với một tài khoản khác.' })
    await prisma.user.update({ where: { id: req.user.id }, data: { customerId: order.customerId } })
  }
  res.json({ ok: true, orderNumber })
}

// --- Sổ địa chỉ ----------------------------------------------------------------------------------
export async function listAddresses(req, res) {
  if (!req.user.customerId) return res.json([])
  res.json(
    await prisma.customerAddress.findMany({
      where: { customerId: req.user.customerId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    }),
  )
}

// Địa chỉ cần hồ sơ khách (để gắn khóa ngoại): tài khoản chưa có hồ sơ thì tạo bằng số điện thoại người nhận nếu số đó còn trống.
async function ensureCustomerId(req, res, phone) {
  if (req.user.customerId) return req.user.customerId
  if (await prisma.customer.findUnique({ where: { phone } })) {
    res.status(409).json({ error: 'Số điện thoại này đã gắn với hồ sơ khác. Hãy nhập số điện thoại của bạn ở mục Thông tin cá nhân trước.' })
    return null
  }
  const customer = await prisma.customer.create({ data: { name: req.user.name, phone } })
  await prisma.user.update({ where: { id: req.user.id }, data: { customerId: customer.id } })
  return customer.id
}

export async function createAddress(req, res) {
  const customerId = await ensureCustomerId(req, res, req.body.phone)
  if (!customerId) return
  const count = await prisma.customerAddress.count({ where: { customerId } })
  if (count >= MAX_ADDRESSES) return res.status(400).json({ error: `Chỉ lưu tối đa ${MAX_ADDRESSES} địa chỉ.` })

  const { isDefault, ...fields } = req.body
  const makeDefault = isDefault || count === 0 // địa chỉ đầu tiên luôn là mặc định
  const address = await prisma.$transaction(async (tx) => {
    if (makeDefault) await tx.customerAddress.updateMany({ where: { customerId }, data: { isDefault: false } })
    return tx.customerAddress.create({ data: { ...fields, customerId, isDefault: !!makeDefault } })
  })
  res.status(201).json(address)
}

export async function updateAddress(req, res) {
  const found = await prisma.customerAddress.findFirst({ where: { id: req.params.id, customerId: req.user.customerId || '' } })
  if (!found) return res.status(404).json({ error: 'Không tìm thấy địa chỉ.' })
  const { isDefault, ...fields } = req.body
  const address = await prisma.$transaction(async (tx) => {
    if (isDefault) await tx.customerAddress.updateMany({ where: { customerId: found.customerId }, data: { isDefault: false } })
    return tx.customerAddress.update({ where: { id: found.id }, data: { ...fields, ...(isDefault && { isDefault: true }) } })
  })
  res.json(address)
}

export async function deleteAddress(req, res) {
  const found = await prisma.customerAddress.findFirst({ where: { id: req.params.id, customerId: req.user.customerId || '' } })
  if (!found) return res.status(404).json({ error: 'Không tìm thấy địa chỉ.' })
  await prisma.$transaction(async (tx) => {
    await tx.customerAddress.delete({ where: { id: found.id } })
    if (found.isDefault) {
      const next = await tx.customerAddress.findFirst({ where: { customerId: found.customerId }, orderBy: { createdAt: 'desc' } })
      if (next) await tx.customerAddress.update({ where: { id: next.id }, data: { isDefault: true } })
    }
  })
  res.json({ ok: true })
}
