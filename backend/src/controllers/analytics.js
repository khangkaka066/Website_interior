import { prisma } from '../lib/prisma.js'
import { toPlain } from '../utils/serialize.js'

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
      return { from: new Date(startOfToday.getTime() - 29 * 86400000), to: now }
  }
}

function previousPeriod(from, to) {
  const spanMs = to.getTime() - from.getTime()
  return { from: new Date(from.getTime() - spanMs), to: new Date(from.getTime()) }
}

// --- Event ingestion ----------------------------------------------------

export async function postEvent(req, res) {
  const { sessionId, type, path, productId, orderId, utmSource, utmMedium, utmCampaign } = req.body || {}
  if (!sessionId || !type) return res.status(400).json({ error: 'Thiếu sessionId hoặc type.' })
  if (!['PAGE_VIEW', 'ADD_TO_CART', 'CHECKOUT_START', 'PURCHASE'].includes(type)) {
    return res.status(400).json({ error: 'Loại sự kiện không hợp lệ.' })
  }

  const event = await prisma.analyticsEvent.create({
    data: { sessionId, type, path, productId, orderId, utmSource, utmMedium, utmCampaign },
  })
  res.status(201).json(toPlain(event))
}

// --- Reports --------------------------------------------------------------

export async function getOverview(req, res) {
  const { range = '30d', dateFrom, dateTo } = req.query
  const { from, to } = dateRangeFor(range, dateFrom, dateTo)
  const prevRange = previousPeriod(from, to)

  const orderWhere = { createdAt: { gte: from, lte: to }, status: { not: 'CANCELLED' } }

  const [orders, prevOrders] = await Promise.all([
    prisma.order.findMany({ where: orderWhere, select: { total: true, createdAt: true, campaignId: true, customerId: true } }),
    prisma.order.findMany({
      where: { createdAt: { gte: prevRange.from, lte: prevRange.to }, status: { not: 'CANCELLED' } },
      select: { total: true },
    }),
  ])

  const revenue = orders.reduce((sum, o) => sum + Number(o.total), 0)
  const prevRevenue = prevOrders.reduce((sum, o) => sum + Number(o.total), 0)
  const revenueChange = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null

  const orderCount = orders.length
  const prevOrderCount = prevOrders.length
  const orderChange = prevOrderCount > 0 ? ((orderCount - prevOrderCount) / prevOrderCount) * 100 : null

  const aov = orderCount > 0 ? revenue / orderCount : 0

  // Revenue/orders by day, for the trend chart.
  const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000))
  const buckets = Array.from({ length: days }, (_, i) => {
    const d = new Date(from.getTime() + i * 86400000)
    return { date: d, label: `${d.getDate()}/${d.getMonth() + 1}`, revenue: 0, orders: 0 }
  })
  for (const o of orders) {
    const idx = Math.floor((new Date(o.createdAt).getTime() - from.getTime()) / 86400000)
    if (buckets[idx]) {
      buckets[idx].revenue += Number(o.total)
      buckets[idx].orders += 1
    }
  }

  res.json({
    range: { from, to },
    revenue,
    revenueChange,
    orderCount,
    orderChange,
    aov,
    trend: buckets.map((b) => ({ label: b.label, revenue: b.revenue, orders: b.orders })),
  })
}

export async function getFunnel(req, res) {
  const { range = '30d', dateFrom, dateTo } = req.query
  const { from, to } = dateRangeFor(range, dateFrom, dateTo)

  const events = await prisma.analyticsEvent.findMany({
    where: { createdAt: { gte: from, lte: to } },
    select: { sessionId: true, type: true },
  })

  const byType = { PAGE_VIEW: new Set(), ADD_TO_CART: new Set(), CHECKOUT_START: new Set(), PURCHASE: new Set() }
  for (const e of events) byType[e.type]?.add(e.sessionId)

  const stages = [
    { key: 'PAGE_VIEW', label: 'Xem trang', count: byType.PAGE_VIEW.size },
    { key: 'ADD_TO_CART', label: 'Thêm vào giỏ', count: byType.ADD_TO_CART.size },
    { key: 'CHECKOUT_START', label: 'Bắt đầu thanh toán', count: byType.CHECKOUT_START.size },
    { key: 'PURCHASE', label: 'Đặt hàng thành công', count: byType.PURCHASE.size },
  ]

  const withRates = stages.map((s, i) => ({
    ...s,
    rateFromPrev: i === 0 ? 100 : stages[i - 1].count > 0 ? (s.count / stages[i - 1].count) * 100 : 0,
    rateFromFirst: stages[0].count > 0 ? (s.count / stages[0].count) * 100 : 0,
  }))

  res.json({ stages: withRates })
}

export async function getAdsPerformance(req, res) {
  const { range = '30d', dateFrom, dateTo } = req.query
  const { from, to } = dateRangeFor(range, dateFrom, dateTo)

  const campaigns = await prisma.campaign.findMany()
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: from, lte: to }, status: { not: 'CANCELLED' }, campaignId: { not: null } },
    select: { total: true, campaignId: true, customerId: true, createdAt: true },
  })

  // First-ever order date per customer, to know whether an order in range
  // represents a newly-acquired customer (for CAC).
  const customerIds = [...new Set(orders.map((o) => o.customerId))]
  const firstOrders = await prisma.order.groupBy({
    by: ['customerId'],
    where: { customerId: { in: customerIds }, status: { not: 'CANCELLED' } },
    _min: { createdAt: true },
  })
  const firstOrderDate = Object.fromEntries(firstOrders.map((f) => [f.customerId, f._min.createdAt]))

  const ordersByCampaign = {}
  for (const o of orders) {
    const list = ordersByCampaign[o.campaignId] || []
    list.push(o)
    ordersByCampaign[o.campaignId] = list
  }

  const rows = campaigns.map((c) => {
    const campOrders = ordersByCampaign[c.id] || []
    const revenue = campOrders.reduce((sum, o) => sum + Number(o.total), 0)
    const orderCount = campOrders.length
    const newCustomers = new Set(
      campOrders.filter((o) => firstOrderDate[o.customerId] && new Date(firstOrderDate[o.customerId]) >= from).map((o) => o.customerId),
    ).size
    const spent = Number(c.spentAmount)
    return {
      id: c.id,
      name: c.name,
      platform: c.platform,
      status: c.status,
      spent,
      orders: orderCount,
      revenue,
      newCustomers,
      roas: spent > 0 ? revenue / spent : 0,
      cpa: orderCount > 0 ? spent / orderCount : 0,
      cac: newCustomers > 0 ? spent / newCustomers : 0,
    }
  })

  const totalSpent = rows.reduce((sum, r) => sum + r.spent, 0)
  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0)
  const totalOrders = rows.reduce((sum, r) => sum + r.orders, 0)
  const totalNewCustomers = rows.reduce((sum, r) => sum + r.newCustomers, 0)

  res.json({
    rows: toPlain(rows),
    totals: {
      spent: totalSpent,
      revenue: totalRevenue,
      orders: totalOrders,
      newCustomers: totalNewCustomers,
      roas: totalSpent > 0 ? totalRevenue / totalSpent : 0,
      cpa: totalOrders > 0 ? totalSpent / totalOrders : 0,
      cac: totalNewCustomers > 0 ? totalSpent / totalNewCustomers : 0,
    },
  })
}

export async function getInsights(req, res) {
  const { range = '30d', dateFrom, dateTo } = req.query
  const { from, to } = dateRangeFor(range, dateFrom, dateTo)
  const prevRange = previousPeriod(from, to)

  const insights = []

  const [orders, prevOrders] = await Promise.all([
    prisma.order.findMany({ where: { createdAt: { gte: from, lte: to }, status: { not: 'CANCELLED' } }, include: { items: true } }),
    prisma.order.aggregate({
      where: { createdAt: { gte: prevRange.from, lte: prevRange.to }, status: { not: 'CANCELLED' } },
      _sum: { total: true },
    }),
  ])

  const revenue = orders.reduce((sum, o) => sum + Number(o.total), 0)
  const prevRevenue = Number(prevOrders._sum.total) || 0
  if (prevRevenue > 0) {
    const change = ((revenue - prevRevenue) / prevRevenue) * 100
    insights.push({
      type: change >= 0 ? 'positive' : 'negative',
      text: `Doanh thu ${change >= 0 ? 'tăng' : 'giảm'} ${Math.abs(change).toFixed(1)}% so với kỳ trước.`,
    })
  }

  // Best-selling product in range.
  const qtyByProduct = {}
  for (const o of orders) {
    for (const it of o.items) {
      qtyByProduct[it.name] = (qtyByProduct[it.name] || 0) + it.quantity
    }
  }
  const topProduct = Object.entries(qtyByProduct).sort((a, b) => b[1] - a[1])[0]
  if (topProduct) {
    insights.push({ type: 'neutral', text: `Sản phẩm bán chạy nhất kỳ này: "${topProduct[0]}" (${topProduct[1]} sản phẩm).` })
  }

  // Funnel biggest drop-off.
  const events = await prisma.analyticsEvent.findMany({ where: { createdAt: { gte: from, lte: to } }, select: { sessionId: true, type: true } })
  const byType = { PAGE_VIEW: new Set(), ADD_TO_CART: new Set(), CHECKOUT_START: new Set(), PURCHASE: new Set() }
  for (const e of events) byType[e.type]?.add(e.sessionId)
  const stageOrder = ['PAGE_VIEW', 'ADD_TO_CART', 'CHECKOUT_START', 'PURCHASE']
  const stageLabels = { PAGE_VIEW: 'Xem trang', ADD_TO_CART: 'Thêm vào giỏ', CHECKOUT_START: 'Bắt đầu thanh toán', PURCHASE: 'Đặt hàng' }
  let worstDrop = null
  for (let i = 1; i < stageOrder.length; i++) {
    const prevCount = byType[stageOrder[i - 1]].size
    const curCount = byType[stageOrder[i]].size
    if (prevCount === 0) continue
    const dropRate = ((prevCount - curCount) / prevCount) * 100
    if (!worstDrop || dropRate > worstDrop.dropRate) {
      worstDrop = { from: stageOrder[i - 1], to: stageOrder[i], dropRate }
    }
  }
  if (worstDrop && worstDrop.dropRate > 0) {
    insights.push({
      type: 'warning',
      text: `Tỷ lệ rơi rụng lớn nhất ở bước "${stageLabels[worstDrop.from]}" → "${stageLabels[worstDrop.to]}": mất ${worstDrop.dropRate.toFixed(0)}% khách.`,
    })
  }

  // Campaign ROAS extremes.
  const campaigns = await prisma.campaign.findMany({ where: { status: { in: ['ACTIVE', 'COMPLETED'] } } })
  const campaignOrders = await prisma.order.findMany({
    where: { createdAt: { gte: from, lte: to }, status: { not: 'CANCELLED' }, campaignId: { not: null } },
    select: { total: true, campaignId: true },
  })
  const revenueByCampaign = {}
  for (const o of campaignOrders) revenueByCampaign[o.campaignId] = (revenueByCampaign[o.campaignId] || 0) + Number(o.total)
  const roasList = campaigns
    .filter((c) => Number(c.spentAmount) > 0)
    .map((c) => ({ name: c.name, roas: (revenueByCampaign[c.id] || 0) / Number(c.spentAmount) }))
  if (roasList.length > 0) {
    const best = roasList.reduce((a, b) => (b.roas > a.roas ? b : a))
    const worst = roasList.reduce((a, b) => (b.roas < a.roas ? b : a))
    insights.push({ type: 'positive', text: `Chiến dịch hiệu quả nhất: "${best.name}" (ROAS ${best.roas.toFixed(2)}x).` })
    if (worst.name !== best.name && worst.roas < 1) {
      insights.push({ type: 'warning', text: `Chiến dịch "${worst.name}" đang lỗ (ROAS ${worst.roas.toFixed(2)}x) — nên xem lại targeting hoặc ngân sách.` })
    }
  }

  if (insights.length === 0) {
    insights.push({ type: 'neutral', text: 'Chưa đủ dữ liệu trong kỳ này để đưa ra nhận định.' })
  }

  res.json({ insights })
}
