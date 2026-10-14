import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  getShippingDashboard,
  getShippingAlerts,
  listShipments,
  getShipment,
  createShipment,
  updateShipmentStatus,
  cancelShipment,
  setCarrierCode,
  pendingHandoverList,
  createHandoverRecord,
  getHandoverRecord,
} from '../controllers/shipping.js'
import { listCarriers, createCarrier, updateCarrier } from '../controllers/carriers.js'
import { checkGoship } from '../lib/goship.js'
import { goshipConfig, goshipRates, goshipCreate, goshipBulkCreate, goshipWebhook, geocodeLookup } from '../controllers/goshipShipping.js'
import { webhookLimiter } from '../middleware/security.js'
import { validate } from '../middleware/validate.js'
import { requirePermission } from '../middleware/auth.js'

import { createShipmentSchema, shipmentStatusSchema, noteOnlySchema, createCarrierSchema, updateCarrierSchema, goshipCreateShipmentSchema, goshipBulkCreateSchema, carrierCodeSchema, handoverSchema, geocodeSchema } from '../schemas/admin.js'

const router = Router()
const guard = requirePermission('shipping')

router.get('/dashboard', guard, asyncHandler(getShippingDashboard))
router.get('/alerts', guard, asyncHandler(getShippingAlerts))
// Trạng thái kết nối Goship (kiểm tra thật). Đặt trước '/:id' để không bị hiểu là mã vận đơn.
router.get('/goship/status', guard, asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json(await checkGoship())
}))
// Vận đơn Goship (đặt trước '/:id'). Tạo vận đơn là hành động THẬT, phát sinh cước.
router.get('/goship/config', guard, asyncHandler(goshipConfig))
router.post('/geocode', guard, validate(geocodeSchema), asyncHandler(geocodeLookup))
router.get('/goship/orders/:orderId/rates', guard, asyncHandler(goshipRates))
router.post('/goship/bulk-shipments', guard, validate(goshipBulkCreateSchema), asyncHandler(goshipBulkCreate))
router.post('/goship/orders/:orderId/shipment', guard, validate(goshipCreateShipmentSchema), asyncHandler(goshipCreate))
// Webhook công khai từ Goship: xác thực bằng chữ ký HMAC (Client Secret), không dùng đăng nhập.
router.post('/goship/webhook', webhookLimiter, asyncHandler(goshipWebhook))
router.get('/carriers', guard, asyncHandler(listCarriers))
router.post('/carriers', guard, validate(createCarrierSchema), asyncHandler(createCarrier))
router.patch('/carriers/:id', guard, validate(updateCarrierSchema), asyncHandler(updateCarrier))
router.get('/', guard, asyncHandler(listShipments))
router.post('/', guard, validate(createShipmentSchema), asyncHandler(createShipment))
router.get('/handovers', guard, asyncHandler(pendingHandoverList)) // trước '/:id'
router.post('/handovers', guard, validate(handoverSchema), asyncHandler(createHandoverRecord))
router.get('/handovers/:id', guard, asyncHandler(getHandoverRecord))
router.get('/:id', guard, asyncHandler(getShipment))
router.patch('/:id/status', guard, validate(shipmentStatusSchema), asyncHandler(updateShipmentStatus))
router.patch('/:id/carrier-code', guard, validate(carrierCodeSchema), asyncHandler(setCarrierCode))
router.post('/:id/cancel', guard, validate(noteOnlySchema), asyncHandler(cancelShipment))

export default router
