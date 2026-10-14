import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { loginLimiter, trackLimiter } from '../middleware/security.js'
import {
  requireCustomer,
  getProfile,
  updateProfile,
  changePassword,
  listMyOrders,
  getMyOrder,
  claimOrder,
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
} from '../controllers/account.js'
import { cancelMyOrder, receiveMyOrder, returnMyOrder, reviewMyOrder } from '../controllers/customerOrders.js'
import { cancelMyOrderSchema, receiveMyOrderSchema, returnMyOrderSchema, reviewMyOrderSchema } from '../schemas/orders.js'
import { updateProfileSchema, changePasswordSchema, addressSchema, claimOrderSchema } from '../schemas/account.js'

const router = Router()
router.use(requireAuth, requireCustomer)

router.get('/profile', asyncHandler(getProfile))
router.patch('/profile', validate(updateProfileSchema), asyncHandler(updateProfile))
router.post('/password', loginLimiter, validate(changePasswordSchema), asyncHandler(changePassword))

router.get('/orders', asyncHandler(listMyOrders))
router.post('/orders/claim', trackLimiter, validate(claimOrderSchema), asyncHandler(claimOrder))
router.get('/orders/:orderNumber', asyncHandler(getMyOrder))
router.post('/orders/:orderNumber/cancel', validate(cancelMyOrderSchema), asyncHandler(cancelMyOrder))
router.post('/orders/:orderNumber/received', validate(receiveMyOrderSchema), asyncHandler(receiveMyOrder))
router.post('/orders/:orderNumber/return', validate(returnMyOrderSchema), asyncHandler(returnMyOrder))
router.post('/orders/:orderNumber/reviews', validate(reviewMyOrderSchema), asyncHandler(reviewMyOrder))

router.get('/addresses', asyncHandler(listAddresses))
router.post('/addresses', validate(addressSchema), asyncHandler(createAddress))
router.patch('/addresses/:id', validate(addressSchema.partial()), asyncHandler(updateAddress))
router.delete('/addresses/:id', asyncHandler(deleteAddress))

export default router
