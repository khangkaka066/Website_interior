import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  listCustomers,
  getCustomersOverview,
  getCustomer,
  createCustomer,
  updateCustomer,
  updateCustomerStatus,
  addAddress,
  deleteAddress,
  addNote,
} from '../controllers/customers.js'
import { validate } from '../middleware/validate.js'
import { requirePermission } from '../middleware/auth.js'

import { createCustomerSchema, updateCustomerSchema, customerStatusSchema, addAddressSchema, addNoteSchema } from '../schemas/admin.js'

const router = Router()
const guard = requirePermission('customers')

router.get('/overview', guard, asyncHandler(getCustomersOverview))
router.get('/', guard, asyncHandler(listCustomers))
router.post('/', guard, validate(createCustomerSchema), asyncHandler(createCustomer))
router.get('/:id', guard, asyncHandler(getCustomer))
router.patch('/:id', guard, validate(updateCustomerSchema), asyncHandler(updateCustomer))
router.post('/:id/status', guard, validate(customerStatusSchema), asyncHandler(updateCustomerStatus))
router.post('/:id/addresses', guard, validate(addAddressSchema), asyncHandler(addAddress))
router.delete('/:id/addresses/:addressId', guard, asyncHandler(deleteAddress))
router.post('/:id/notes', guard, validate(addNoteSchema), asyncHandler(addNote))

export default router
