import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  listOrders,
  trackOrder,
  payosRelink,
  getOrder,
  createOrder,
  updateOrderStatus,
  confirmOrder,
  cancelOrder,
  refundOrder,
} from '../controllers/orders.js'
import { requirePermission } from '../middleware/auth.js'
import { orderLimiter, trackLimiter } from '../middleware/security.js'
import { validate } from '../middleware/validate.js'
import { createOrderSchema, payosRelinkSchema } from '../schemas/orders.js'

import { orderStatusSchema, noteOnlySchema } from '../schemas/admin.js'

const router = Router()
const guard = requirePermission('orders')

// Checkout stays public — anyone shopping the storefront can place an order.
router.post('/', orderLimiter, validate(createOrderSchema), asyncHandler(createOrder))

// Tra cứu công khai: phải đặt trước '/:id'.
router.get('/track', trackLimiter, asyncHandler(trackOrder))
router.post('/payos-link', trackLimiter, validate(payosRelinkSchema), asyncHandler(payosRelink))

router.get('/', guard, asyncHandler(listOrders))
router.get('/:id', guard, asyncHandler(getOrder))
router.patch('/:id/status', guard, validate(orderStatusSchema), asyncHandler(updateOrderStatus))
router.post('/:id/confirm', guard, validate(noteOnlySchema), asyncHandler(confirmOrder))
router.post('/:id/cancel', guard, validate(noteOnlySchema), asyncHandler(cancelOrder))
router.post('/:id/refund', guard, validate(noteOnlySchema), asyncHandler(refundOrder))

export default router
