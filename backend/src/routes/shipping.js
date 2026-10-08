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
} from '../controllers/shipping.js'
import { listCarriers, createCarrier, updateCarrier } from '../controllers/carriers.js'
import { validate } from '../middleware/validate.js'
import { requirePermission } from '../middleware/auth.js'

import { createShipmentSchema, shipmentStatusSchema, noteOnlySchema, createCarrierSchema, updateCarrierSchema } from '../schemas/admin.js'

const router = Router()
const guard = requirePermission('shipping')

router.get('/dashboard', guard, asyncHandler(getShippingDashboard))
router.get('/alerts', guard, asyncHandler(getShippingAlerts))
router.get('/carriers', guard, asyncHandler(listCarriers))
router.post('/carriers', guard, validate(createCarrierSchema), asyncHandler(createCarrier))
router.patch('/carriers/:id', guard, validate(updateCarrierSchema), asyncHandler(updateCarrier))
router.get('/', guard, asyncHandler(listShipments))
router.post('/', guard, validate(createShipmentSchema), asyncHandler(createShipment))
router.get('/:id', guard, asyncHandler(getShipment))
router.patch('/:id/status', guard, validate(shipmentStatusSchema), asyncHandler(updateShipmentStatus))
router.post('/:id/cancel', guard, validate(noteOnlySchema), asyncHandler(cancelShipment))

export default router
