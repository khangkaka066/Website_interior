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
import { requirePermission } from '../middleware/auth.js'

const router = Router()
const guard = requirePermission('customers')

router.get('/overview', guard, asyncHandler(getCustomersOverview))
router.get('/', guard, asyncHandler(listCustomers))
router.post('/', guard, asyncHandler(createCustomer))
router.get('/:id', guard, asyncHandler(getCustomer))
router.patch('/:id', guard, asyncHandler(updateCustomer))
router.post('/:id/status', guard, asyncHandler(updateCustomerStatus))
router.post('/:id/addresses', guard, asyncHandler(addAddress))
router.delete('/:id/addresses/:addressId', guard, asyncHandler(deleteAddress))
router.post('/:id/notes', guard, asyncHandler(addNote))

export default router
