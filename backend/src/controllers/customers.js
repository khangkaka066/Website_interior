import { prisma } from '../lib/prisma.js'
import { toPlain } from '../utils/serialize.js'
import { classifySegment } from '../utils/customerSegment.js'

const ORDER_STATS_SELECT = { id: true, total: true, status: true, createdAt: true }

function computeStats(orders) {
  const nonCancelled = orders.filter((o) => o.status !== 'CANCELLED')
  const totalSpent = nonCancelled.reduce((sum, o) => sum + Number(o.total), 0)
  const lastOrderAt = nonCancelled.length > 0
    ? nonCancelled.reduce((max, o) => (o.createdAt > max ? o.createdAt : max), nonCancelled[0].createdAt)
    : null
  const firstOrderAt = orders.length > 0
    ? orders.reduce((min, o) => (o.createdAt < min ? o.createdAt : min), orders[0].createdAt)
    : null
  return {
    orderCount: orders.length,
    totalSpent,
    aov: nonCancelled.length > 0 ? totalSpent / nonCancelled.length : 0,
    lastOrderAt,
    firstOrderAt,
  }
}

function dateRangeFor(preset, from, to) {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (preset) {
    case 'today':
      return { from: startOfToday, to: now }
    case '7d':
      return { from: new Date(startOfToday.getTime() - 6 * 86400000), to: now }
    case '30d':
      return { from: new Date(startOfToday.getTime() - 29 * 86400000), to: now }
    case 'month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now }
    case 'custom':
      return { from: from ? new Date(from) : null, to: to ? new Date(to) : now }
    default:
      return { from: null, to: null }
  }
}

export async function listCustomers(req, res) {
  const {
    search = '',
    status,
    segment,
    dateFrom,
    dateTo,
    minSpent,
    maxSpent,
    minOrders,
    maxOrders,
    sortBy = 'latest',
    page = '1',
    pageSize = '10',
  } = req.query

  const customers = await prisma.customer.findMany({
    include: { orders: { select: ORDER_STATS_SELECT } },
  })

  let rows = customers.map((c) => {
    const stats = computeStats(c.orders)
    return {
      ...toPlain(c),
      orders: undefined,
      ...stats,
      segment: classifySegment(stats),
    }
  })

  if (search) {
    const q = search.toLowerCase()
    rows = rows.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.id.toLowerCase().includes(q),
    )
  }
  if (status) rows = rows.filter((c) => c.status === status)
  if (segment) rows = rows.filter((c) => c.segment === segment)
  if (dateFrom) rows = rows.filter((c) => new Date(c.createdAt) >= new Date(dateFrom))
  if (dateTo) rows = rows.filter((c) => new Date(c.createdAt) <= new Date(dateTo))
  if (minSpent) rows = rows.filter((c) => c.totalSpent >= Number(minSpent))
  if (maxSpent) rows = rows.filter((c) => c.totalSpent <= Number(maxSpent))
  if (minOrders) rows = rows.filter((c) => c.orderCount >= Number(minOrders))
  if (maxOrders) rows = rows.filter((c) => c.orderCount <= Number(maxOrders))

  if (sortBy === 'spending') rows.sort((a, b) => b.totalSpent - a.totalSpent)
  else if (sortBy === 'orders') rows.sort((a, b) => b.orderCount - a.orderCount)
  else if (sortBy === 'activity') rows.sort((a, b) => new Date(b.lastOrderAt || 0) - new Date(a.lastOrderAt || 0))
  else rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const total = rows.length
  const take = Math.max(1, Math.min(100, Number(pageSize) || 10))
  const skip = (Math.max(1, Number(page) || 1) - 1) * take
  const items = rows.slice(skip, skip + take)

  res.json({ items, total, page: Number(page) || 1, pageSize: take })
}

export async function getCustomersOverview(req, res) {
  const { range = '30d', dateFrom, dateTo } = req.query
  const { from, to } = dateRangeFor(range, dateFrom, dateTo)

  const customers = await prisma.customer.findMany({
    include: { orders: { select: ORDER_STATS_SELECT } },
  })

  const enriched = customers.map((c) => {
    const stats = computeStats(c.orders)
    return { ...c, ...stats, segment: classifySegment(stats) }
  })

  const inRange = (date) => (!from || new Date(date) >= from) && (!to || new Date(date) <= to)

  const totalCustomers = enriched.length
  const newCustomers = enriched.filter((c) => inRange(c.createdAt)).length
  const activeCustomers = enriched.filter((c) => c.status === 'ACTIVE').length
  const returningCustomers = enriched.filter((c) => c.segment === 'RETURNING').length
  const vipCustomers = enriched.filter((c) => c.segment === 'VIP').length

  const allOrdersInRange = enriched.flatMap((c) =>
    c.orders.filter((o) => o.status !== 'CANCELLED' && inRange(o.createdAt)),
  )
  const totalRevenue = allOrdersInRange.reduce((sum, o) => sum + Number(o.total), 0)
  const avgOrderValue = allOrdersInRange.length > 0 ? totalRevenue / allOrdersInRange.length : 0

  const segmentSummary = ['NEW', 'RETURNING', 'VIP', 'HIGH_VALUE', 'AT_RISK', 'INACTIVE'].map((seg) => {
    const group = enriched.filter((c) => c.segment === seg)
    const revenue = group.reduce((sum, c) => sum + c.totalSpent, 0)
    const orders = group.reduce((sum, c) => sum + c.orderCount, 0)
    return {
      segment: seg,
      customers: group.length,
      revenue,
      orders,
      aov: orders > 0 ? revenue / orders : 0,
    }
  })

  // New vs returning customers per month, last 6 months.
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (5 - i), 1)
    return { year: d.getFullYear(), month: d.getMonth(), label: `T${d.getMonth() + 1}` }
  })
  const newVsReturning = months.map(({ year, month, label }) => {
    let newCount = 0
    let returningCount = 0
    for (const c of enriched) {
      const ordersInMonth = c.orders.filter(
        (o) => o.status !== 'CANCELLED' && new Date(o.createdAt).getFullYear() === year && new Date(o.createdAt).getMonth() === month,
      )
      if (ordersInMonth.length === 0) continue
      if (c.firstOrderAt && new Date(c.firstOrderAt).getFullYear() === year && new Date(c.firstOrderAt).getMonth() === month) {
        newCount += 1
      } else {
        returningCount += 1
      }
    }
    return { label, new: newCount, returning: returningCount }
  })

  res.json({
    totalCustomers,
    newCustomers,
    activeCustomers,
    returningCustomers,
    vipCustomers,
    avgOrderValue,
    totalRevenue,
    segmentSummary,
    newVsReturning,
  })
}

export async function getCustomer(req, res) {
  const customer = await prisma.customer.findUnique({
    where: { id: req.params.id },
    include: {
      addresses: { orderBy: { isDefault: 'desc' } },
      notes: { orderBy: { createdAt: 'desc' } },
      orders: {
        orderBy: { createdAt: 'desc' },
        include: { items: true, shipment: { select: { status: true } } },
      },
    },
  })
  if (!customer) return res.status(404).json({ error: 'Không tìm thấy khách hàng.' })

  const stats = computeStats(customer.orders)
  const segment = classifySegment(stats)
  const nonCancelledCount = customer.orders.filter((o) => o.status !== 'CANCELLED').length
  const repeatRate = nonCancelledCount > 0 ? ((nonCancelledCount - 1) / nonCancelledCount) * 100 : 0

  // Monthly revenue / orders / AOV for the spending chart, last 6 months.
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (5 - i), 1)
    return { year: d.getFullYear(), month: d.getMonth(), label: `T${d.getMonth() + 1}` }
  })
  const spendingByMonth = months.map(({ year, month, label }) => {
    const ordersInMonth = customer.orders.filter(
      (o) => o.status !== 'CANCELLED' && new Date(o.createdAt).getFullYear() === year && new Date(o.createdAt).getMonth() === month,
    )
    const revenue = ordersInMonth.reduce((sum, o) => sum + Number(o.total), 0)
    return { label, revenue, orders: ordersInMonth.length, aov: ordersInMonth.length > 0 ? revenue / ordersInMonth.length : 0 }
  })

  // Lightweight activity timeline synthesized from what we already track —
  // no separate event-log table needed.
  const timeline = [{ event: 'Đăng ký tài khoản', timestamp: customer.createdAt }]
  customer.orders
    .slice()
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .forEach((o, idx) => {
      timeline.push({
        event: idx === 0 ? 'Đơn hàng đầu tiên' : `Đơn hàng #${idx + 1}`,
        timestamp: o.createdAt,
        orderId: o.id,
        orderNumber: o.orderNumber,
      })
      if (o.status === 'DELIVERED') {
        timeline.push({ event: 'Nhận hàng thành công', timestamp: o.updatedAt, orderId: o.id, orderNumber: o.orderNumber })
      }
    })
  timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

  res.json({
    ...toPlain(customer),
    ...stats,
    segment,
    repeatRate,
    spendingByMonth,
    timeline: toPlain(timeline),
  })
}

export async function createCustomer(req, res) {
  const { name, email, phone, dob, gender, avatarUrl, tags, address } = req.body || {}

  if (!name || !phone) {
    return res.status(400).json({ error: 'Thiếu họ tên hoặc số điện thoại.' })
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Email không hợp lệ.' })
  }

  const existingPhone = await prisma.customer.findUnique({ where: { phone } })
  if (existingPhone) return res.status(400).json({ error: 'Số điện thoại đã tồn tại.' })
  if (email) {
    const existingEmail = await prisma.customer.findUnique({ where: { email } })
    if (existingEmail) return res.status(400).json({ error: 'Email đã tồn tại.' })
  }

  const customer = await prisma.customer.create({
    data: {
      name,
      phone,
      email: email || null,
      dob: dob ? new Date(dob) : null,
      gender: gender || null,
      avatarUrl: avatarUrl || null,
      tags: tags || [],
      addresses: address
        ? { create: { ...address, isDefault: true } }
        : undefined,
    },
    include: { addresses: true },
  })

  res.status(201).json(toPlain(customer))
}

export async function updateCustomer(req, res) {
  const { name, email, phone, dob, gender, avatarUrl, tags } = req.body || {}
  const customer = await prisma.customer.findUnique({ where: { id: req.params.id } })
  if (!customer) return res.status(404).json({ error: 'Không tìm thấy khách hàng.' })

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Email không hợp lệ.' })
  }
  if (phone && phone !== customer.phone) {
    const existing = await prisma.customer.findUnique({ where: { phone } })
    if (existing) return res.status(400).json({ error: 'Số điện thoại đã tồn tại.' })
  }
  if (email && email !== customer.email) {
    const existing = await prisma.customer.findUnique({ where: { email } })
    if (existing) return res.status(400).json({ error: 'Email đã tồn tại.' })
  }

  const updated = await prisma.customer.update({
    where: { id: customer.id },
    data: {
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email: email || null }),
      ...(phone !== undefined && { phone }),
      ...(dob !== undefined && { dob: dob ? new Date(dob) : null }),
      ...(gender !== undefined && { gender }),
      ...(avatarUrl !== undefined && { avatarUrl }),
      ...(tags !== undefined && { tags }),
    },
  })
  res.json(toPlain(updated))
}

export async function updateCustomerStatus(req, res) {
  const { status } = req.body || {}
  if (!['ACTIVE', 'INACTIVE', 'BLOCKED'].includes(status)) {
    return res.status(400).json({ error: 'Trạng thái không hợp lệ.' })
  }
  const customer = await prisma.customer.findUnique({ where: { id: req.params.id } })
  if (!customer) return res.status(404).json({ error: 'Không tìm thấy khách hàng.' })

  const updated = await prisma.customer.update({ where: { id: customer.id }, data: { status } })
  res.json(toPlain(updated))
}

export async function addAddress(req, res) {
  const { recipientName, phone, addressLine, ward, district, province, isDefault } = req.body || {}
  if (!recipientName || !phone || !addressLine || !province) {
    return res.status(400).json({ error: 'Thiếu thông tin địa chỉ.' })
  }
  const customer = await prisma.customer.findUnique({ where: { id: req.params.id } })
  if (!customer) return res.status(404).json({ error: 'Không tìm thấy khách hàng.' })

  if (isDefault) {
    await prisma.customerAddress.updateMany({ where: { customerId: customer.id }, data: { isDefault: false } })
  }

  const address = await prisma.customerAddress.create({
    data: { customerId: customer.id, recipientName, phone, addressLine, ward, district, province, isDefault: !!isDefault },
  })
  res.status(201).json(toPlain(address))
}

export async function deleteAddress(req, res) {
  const address = await prisma.customerAddress.findUnique({ where: { id: req.params.addressId } })
  if (!address || address.customerId !== req.params.id) {
    return res.status(404).json({ error: 'Không tìm thấy địa chỉ.' })
  }
  await prisma.customerAddress.delete({ where: { id: address.id } })
  res.json({ ok: true })
}

export async function addNote(req, res) {
  const { content } = req.body || {}
  if (!content) return res.status(400).json({ error: 'Nội dung ghi chú không được để trống.' })
  const customer = await prisma.customer.findUnique({ where: { id: req.params.id } })
  if (!customer) return res.status(404).json({ error: 'Không tìm thấy khách hàng.' })

  const note = await prisma.customerNote.create({
    data: { customerId: customer.id, content, author: 'admin' },
  })
  res.status(201).json(toPlain(note))
}
