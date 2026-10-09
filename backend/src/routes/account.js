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
import { updateProfileSchema, changePasswordSchema, addressSchema, claimOrderSchema } from '../schemas/account.js'

const router = Router()
router.use(requireAuth, requireCustomer)

router.get('/profile', asyncHandler(getProfile))
router.patch('/profile', validate(updateProfileSchema), asyncHandler(updateProfile))
router.post('/password', loginLimiter, validate(changePasswordSchema), asyncHandler(changePassword))

router.get('/orders', asyncHandler(listMyOrders))
router.post('/orders/claim', trackLimiter, validate(claimOrderSchema), asyncHandler(claimOrder))
router.get('/orders/:orderNumber', asyncHandler(getMyOrder))

router.get('/addresses', asyncHandler(listAddresses))
router.post('/addresses', validate(addressSchema), asyncHandler(createAddress))
router.patch('/addresses/:id', validate(addressSchema.partial()), asyncHandler(updateAddress))
router.delete('/addresses/:id', asyncHandler(deleteAddress))

export default router
