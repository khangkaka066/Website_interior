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
import { requirePermission } from '../middleware/auth.js'

const router = Router()
const guard = requirePermission('shipping')

router.get('/dashboard', guard, asyncHandler(getShippingDashboard))
router.get('/alerts', guard, asyncHandler(getShippingAlerts))
router.get('/carriers', guard, asyncHandler(listCarriers))
router.post('/carriers', guard, asyncHandler(createCarrier))
router.patch('/carriers/:id', guard, asyncHandler(updateCarrier))
router.get('/', guard, asyncHandler(listShipments))
router.post('/', guard, asyncHandler(createShipment))
router.get('/:id', guard, asyncHandler(getShipment))
router.patch('/:id/status', guard, asyncHandler(updateShipmentStatus))
router.post('/:id/cancel', guard, asyncHandler(cancelShipment))

export default router
