import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  listOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
  confirmOrder,
  cancelOrder,
  refundOrder,
} from '../controllers/orders.js'

const router = Router()

router.get('/', asyncHandler(listOrders))
router.post('/', asyncHandler(createOrder))
router.get('/:id', asyncHandler(getOrder))
router.patch('/:id/status', asyncHandler(updateOrderStatus))
router.post('/:id/confirm', asyncHandler(confirmOrder))
router.post('/:id/cancel', asyncHandler(cancelOrder))
router.post('/:id/refund', asyncHandler(refundOrder))

export default router
