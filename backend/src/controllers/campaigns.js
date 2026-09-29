import { prisma } from '../lib/prisma.js'
import { toPlain } from '../utils/serialize.js'

const CAMPAIGN_INCLUDE = {
  adSets: { include: { ads: true }, orderBy: { createdAt: 'asc' } },
}

export async function listCampaigns(req, res) {
  const { status, platform, search = '' } = req.query
  const where = {}
  if (status) where.status = status
  if (platform) where.platform = platform
  if (search) where.name = { contains: search, mode: 'insensitive' }

  const campaigns = await prisma.campaign.findMany({
    where,
    include: {
      adSets: { select: { id: true, ads: { select: { id: true } } } },
      _count: { select: { orders: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const orderStats = await prisma.order.groupBy({
    by: ['campaignId'],
    where: { campaignId: { not: null }, status: { not: 'CANCELLED' } },
    _sum: { total: true },
    _count: true,
  })
  const statsByCampaign = Object.fromEntries(orderStats.map((s) => [s.campaignId, s]))

  const items = campaigns.map((c) => {
    const stat = statsByCampaign[c.id]
    const revenue = stat ? Number(stat._sum.total) : 0
    const orders = stat ? stat._count : 0
    const spent = Number(c.spentAmount)
    return {
      ...toPlain(c),
      adSetCount: c.adSets.length,
      adCount: c.adSets.reduce((sum, s) => sum + s.ads.length, 0),
      orders,
      revenue,
      roas: spent > 0 ? revenue / spent : 0,
      adSets: undefined,
      _count: undefined,
    }
  })

  res.json({ items })
}

export async function getCampaign(req, res) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: req.params.id },
    include: CAMPAIGN_INCLUDE,
  })
  if (!campaign) return res.status(404).json({ error: 'Không tìm thấy chiến dịch.' })

  const orderAgg = await prisma.order.aggregate({
    where: { campaignId: campaign.id, status: { not: 'CANCELLED' } },
    _sum: { total: true },
    _count: true,
  })
  const revenue = Number(orderAgg._sum.total) || 0
  const orders = orderAgg._count
  const spent = Number(campaign.spentAmount)

  res.json({
    ...toPlain(campaign),
    orders,
    revenue,
    roas: spent > 0 ? revenue / spent : 0,
    cpa: orders > 0 ? spent / orders : 0,
  })
}

export async function createCampaign(req, res) {
  const { name, platform, objective, budgetTotal, budgetDaily, startDate, endDate, utmCode } = req.body || {}
  if (!name || !platform || !objective || !budgetTotal || !startDate || !utmCode) {
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc để tạo chiến dịch.' })
  }

  const existing = await prisma.campaign.findUnique({ where: { utmCode } })
  if (existing) return res.status(400).json({ error: 'Mã UTM này đã được dùng cho chiến dịch khác.' })

  const campaign = await prisma.campaign.create({
    data: {
      name,
      platform,
      objective,
      budgetTotal,
      budgetDaily: budgetDaily || null,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      utmCode,
    },
  })
  res.status(201).json(toPlain(campaign))
}

export async function updateCampaign(req, res) {
  const { name, platform, objective, status, budgetTotal, budgetDaily, spentAmount, startDate, endDate } = req.body || {}
  const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } })
  if (!campaign) return res.status(404).json({ error: 'Không tìm thấy chiến dịch.' })

  const updated = await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      ...(name !== undefined && { name }),
      ...(platform !== undefined && { platform }),
      ...(objective !== undefined && { objective }),
      ...(status !== undefined && { status }),
      ...(budgetTotal !== undefined && { budgetTotal }),
      ...(budgetDaily !== undefined && { budgetDaily }),
      ...(spentAmount !== undefined && { spentAmount }),
      ...(startDate !== undefined && { startDate: new Date(startDate) }),
      ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
    },
  })
  res.json(toPlain(updated))
}

export async function deleteCampaign(req, res) {
  const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } })
  if (!campaign) return res.status(404).json({ error: 'Không tìm thấy chiến dịch.' })
  await prisma.campaign.delete({ where: { id: campaign.id } })
  res.json({ ok: true })
}

// --- Ad Sets ---

export async function createAdSet(req, res) {
  const { name, audienceAgeMin, audienceAgeMax, audienceGender, audienceLocation, interests, budget } = req.body || {}
  if (!name || !budget) return res.status(400).json({ error: 'Thiếu tên hoặc ngân sách Ad Set.' })

  const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } })
  if (!campaign) return res.status(404).json({ error: 'Không tìm thấy chiến dịch.' })

  const adSet = await prisma.adSet.create({
    data: {
      campaignId: campaign.id,
      name,
      audienceAgeMin: audienceAgeMin || null,
      audienceAgeMax: audienceAgeMax || null,
      audienceGender: audienceGender || null,
      audienceLocation: audienceLocation || null,
      interests: interests || [],
      budget,
    },
  })
  res.status(201).json(toPlain(adSet))
}

export async function updateAdSet(req, res) {
  const body = req.body || {}
  const adSet = await prisma.adSet.findUnique({ where: { id: req.params.adSetId } })
  if (!adSet || adSet.campaignId !== req.params.id) return res.status(404).json({ error: 'Không tìm thấy Ad Set.' })

  const updated = await prisma.adSet.update({
    where: { id: adSet.id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.audienceAgeMin !== undefined && { audienceAgeMin: body.audienceAgeMin }),
      ...(body.audienceAgeMax !== undefined && { audienceAgeMax: body.audienceAgeMax }),
      ...(body.audienceGender !== undefined && { audienceGender: body.audienceGender }),
      ...(body.audienceLocation !== undefined && { audienceLocation: body.audienceLocation }),
      ...(body.interests !== undefined && { interests: body.interests }),
      ...(body.budget !== undefined && { budget: body.budget }),
      ...(body.status !== undefined && { status: body.status }),
    },
  })
  res.json(toPlain(updated))
}

export async function deleteAdSet(req, res) {
  const adSet = await prisma.adSet.findUnique({ where: { id: req.params.adSetId } })
  if (!adSet || adSet.campaignId !== req.params.id) return res.status(404).json({ error: 'Không tìm thấy Ad Set.' })
  await prisma.adSet.delete({ where: { id: adSet.id } })
  res.json({ ok: true })
}

// --- Ads ---

export async function createAd(req, res) {
  const { name, creativeType, headline, bodyCopy, ctaLabel, imageUrl } = req.body || {}
  if (!name || !headline) return res.status(400).json({ error: 'Thiếu tên hoặc tiêu đề quảng cáo.' })

  const adSet = await prisma.adSet.findUnique({ where: { id: req.params.adSetId } })
  if (!adSet) return res.status(404).json({ error: 'Không tìm thấy Ad Set.' })

  const ad = await prisma.ad.create({
    data: {
      adSetId: adSet.id,
      name,
      creativeType: creativeType || 'IMAGE',
      headline,
      bodyCopy: bodyCopy || null,
      ctaLabel: ctaLabel || null,
      imageUrl: imageUrl || null,
    },
  })
  res.status(201).json(toPlain(ad))
}

export async function updateAd(req, res) {
  const body = req.body || {}
  const ad = await prisma.ad.findUnique({ where: { id: req.params.adId } })
  if (!ad || ad.adSetId !== req.params.adSetId) return res.status(404).json({ error: 'Không tìm thấy quảng cáo.' })

  const updated = await prisma.ad.update({
    where: { id: ad.id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.creativeType !== undefined && { creativeType: body.creativeType }),
      ...(body.headline !== undefined && { headline: body.headline }),
      ...(body.bodyCopy !== undefined && { bodyCopy: body.bodyCopy }),
      ...(body.ctaLabel !== undefined && { ctaLabel: body.ctaLabel }),
      ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
      ...(body.status !== undefined && { status: body.status }),
    },
  })
  res.json(toPlain(updated))
}

export async function deleteAd(req, res) {
  const ad = await prisma.ad.findUnique({ where: { id: req.params.adId } })
  if (!ad || ad.adSetId !== req.params.adSetId) return res.status(404).json({ error: 'Không tìm thấy quảng cáo.' })
  await prisma.ad.delete({ where: { id: ad.id } })
  res.json({ ok: true })
}
