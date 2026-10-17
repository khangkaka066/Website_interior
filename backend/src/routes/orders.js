import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  listOrders,
  orderStatusCounts,
  trackOrder,
  payosRelink,
  getOrder,
  createOrder,
  shippingQuote,
  updateOrderStatus,
  confirmOrder,
  cancelOrder,
  refundOrder,
  bulkOrderStatus,
  approveCancelRequest,
  rejectCancelRequest,
  approveReturnRequest,
  rejectReturnRequest,
  setReviewHidden,
  listReviews,
  recentActivity,
  replyReview,
  prepareOrder,
  scanPackOrder,
  packQueueOrders,
  ordersWorkload,
} from '../controllers/orders.js'
import { cancelMyOrder, receiveMyOrder, returnMyOrder, reviewMyOrder } from '../controllers/customerOrders.js'
import { requirePermission } from '../middleware/auth.js'
import { orderLimiter, trackLimiter, quoteLimiter } from '../middleware/security.js'
import { validate } from '../middleware/validate.js'
import { createOrderSchema, payosRelinkSchema, shippingQuoteSchema, cancelMyOrderSchema, receiveMyOrderSchema, returnMyOrderSchema, reviewMyOrderSchema } from '../schemas/orders.js'

import { orderStatusSchema, noteOnlySchema, bulkOrderStatusSchema, optionalNoteSchema, requiredNoteSchema, reviewHiddenSchema, reviewReplySchema, scanPackSchema } from '../schemas/admin.js'

const router = Router()
const guard = requirePermission('orders')

// Checkout stays public — anyone shopping the storefront can place an order.
router.post('/', orderLimiter, validate(createOrderSchema), asyncHandler(createOrder))
router.post('/shipping-quote', quoteLimiter, validate(shippingQuoteSchema), asyncHandler(shippingQuote)) // trước '/:id'

// Tra cứu công khai: phải đặt trước '/:id'.
router.get('/track', trackLimiter, asyncHandler(trackOrder))
router.post('/payos-link', trackLimiter, validate(payosRelinkSchema), asyncHandler(payosRelink))

// Khách chưa đăng nhập tự hủy / xác nhận đã nhận / trả hàng / đánh giá: cần mã đơn + số điện thoại. Đặt trước '/:id'.
router.post('/self/cancel', trackLimiter, validate(cancelMyOrderSchema), asyncHandler(cancelMyOrder))
router.post('/self/received', trackLimiter, validate(receiveMyOrderSchema), asyncHandler(receiveMyOrder))
router.post('/self/return', trackLimiter, validate(returnMyOrderSchema), asyncHandler(returnMyOrder))
router.post('/self/reviews', trackLimiter, validate(reviewMyOrderSchema), asyncHandler(reviewMyOrder))

router.get('/', guard, asyncHandler(listOrders))
router.get('/status-counts', guard, asyncHandler(orderStatusCounts))
router.get('/workload', guard, asyncHandler(ordersWorkload))
router.get('/pack-queue', guard, asyncHandler(packQueueOrders))
router.post('/scan-pack', guard, validate(scanPackSchema), asyncHandler(scanPackOrder))
router.post('/bulk-status', guard, validate(bulkOrderStatusSchema), asyncHandler(bulkOrderStatus))
router.get('/activity', guard, asyncHandler(recentActivity))
router.get('/reviews', guard, asyncHandler(listReviews))
router.patch('/reviews/:reviewId/reply', guard, validate(reviewReplySchema), asyncHandler(replyReview))
router.patch('/reviews/:reviewId', guard, validate(reviewHiddenSchema), asyncHandler(setReviewHidden))
router.get('/:id', guard, asyncHandler(getOrder))
router.patch('/:id/status', guard, validate(orderStatusSchema), asyncHandler(updateOrderStatus))
router.post('/:id/prepare', guard, asyncHandler(prepareOrder))
router.post('/:id/confirm', guard, validate(noteOnlySchema), asyncHandler(confirmOrder))
router.post('/:id/cancel', guard, validate(noteOnlySchema), asyncHandler(cancelOrder))
router.post('/:id/refund', guard, validate(noteOnlySchema), asyncHandler(refundOrder))
router.post('/:id/cancel-request/approve', guard, validate(optionalNoteSchema), asyncHandler(approveCancelRequest))
router.post('/:id/cancel-request/reject', guard, validate(requiredNoteSchema), asyncHandler(rejectCancelRequest))
router.post('/:id/return/approve', guard, validate(optionalNoteSchema), asyncHandler(approveReturnRequest))
router.post('/:id/return/reject', guard, validate(requiredNoteSchema), asyncHandler(rejectReturnRequest))

export default router
