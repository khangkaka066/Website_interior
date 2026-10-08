import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { requirePermission } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { listPayments, paymentSummary, listUnmatched, confirmPayment, failPayment, refundPayment } from '../controllers/payments.js'
import { handleWebhook } from '../lib/paymentWebhook.js'
import { confirmPaymentSchema, failPaymentSchema, refundPaymentSchema } from '../schemas/payments.js'

const router = Router()
const guard = requirePermission('payments')

// Dịch vụ ngân hàng (SePay/Casso) gọi vào đây khi có tiền về: không dùng đăng nhập mà dùng khóa bí mật riêng (xem .env.example).
router.post('/webhook/:provider', asyncHandler(handleWebhook))

router.get('/', guard, asyncHandler(listPayments))
router.get('/summary', guard, asyncHandler(paymentSummary))
router.get('/unmatched', guard, asyncHandler(listUnmatched))
router.post('/:id/confirm', guard, validate(confirmPaymentSchema), asyncHandler(confirmPayment))
router.post('/:id/fail', guard, validate(failPaymentSchema), asyncHandler(failPayment))
router.post('/:id/refund', guard, validate(refundPaymentSchema), asyncHandler(refundPayment))

export default router
