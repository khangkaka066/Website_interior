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

const router = Router()

router.get('/dashboard', asyncHandler(getShippingDashboard))
router.get('/alerts', asyncHandler(getShippingAlerts))
router.get('/carriers', asyncHandler(listCarriers))
router.post('/carriers', asyncHandler(createCarrier))
router.patch('/carriers/:id', asyncHandler(updateCarrier))
router.get('/', asyncHandler(listShipments))
router.post('/', asyncHandler(createShipment))
router.get('/:id', asyncHandler(getShipment))
router.patch('/:id/status', asyncHandler(updateShipmentStatus))
router.post('/:id/cancel', asyncHandler(cancelShipment))

export default router
