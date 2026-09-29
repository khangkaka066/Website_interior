import { prisma } from '../lib/prisma.js'
import { toPlain } from '../utils/serialize.js'

export async function listCarriers(req, res) {
  const carriers = await prisma.shippingCarrier.findMany({ orderBy: { name: 'asc' } })
  res.json(carriers.map(toPlain))
}

export async function createCarrier(req, res) {
  const { code, name, serviceTypes, apiConfig } = req.body || {}
  if (!code || !name) return res.status(400).json({ error: 'Thiếu mã hoặc tên đơn vị vận chuyển.' })

  const carrier = await prisma.shippingCarrier.create({
    data: { code: code.toUpperCase(), name, serviceTypes, apiConfig, enabled: true, apiStatus: 'disconnected' },
  })
  res.status(201).json(toPlain(carrier))
}

export async function updateCarrier(req, res) {
  const { name, enabled, apiStatus, apiConfig, serviceTypes } = req.body || {}
  const carrier = await prisma.shippingCarrier.findUnique({ where: { id: req.params.id } })
  if (!carrier) return res.status(404).json({ error: 'Không tìm thấy đơn vị vận chuyển.' })

  const updated = await prisma.shippingCarrier.update({
    where: { id: carrier.id },
    data: {
      ...(name !== undefined && { name }),
      ...(enabled !== undefined && { enabled }),
      ...(apiStatus !== undefined && { apiStatus }),
      ...(apiConfig !== undefined && { apiConfig }),
      ...(serviceTypes !== undefined && { serviceTypes }),
    },
  })
  res.json(toPlain(updated))
}
