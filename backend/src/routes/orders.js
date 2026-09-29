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
import { requirePermission } from '../middleware/auth.js'

const router = Router()
const guard = requirePermission('orders')

// Checkout stays public — anyone shopping the storefront can place an order.
router.post('/', asyncHandler(createOrder))

router.get('/', guard, asyncHandler(listOrders))
router.get('/:id', guard, asyncHandler(getOrder))
router.patch('/:id/status', guard, asyncHandler(updateOrderStatus))
router.post('/:id/confirm', guard, asyncHandler(confirmOrder))
router.post('/:id/cancel', guard, asyncHandler(cancelOrder))
router.post('/:id/refund', guard, asyncHandler(refundOrder))

export default router
