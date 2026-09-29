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

const router = Router()

router.get('/overview', asyncHandler(getCustomersOverview))
router.get('/', asyncHandler(listCustomers))
router.post('/', asyncHandler(createCustomer))
router.get('/:id', asyncHandler(getCustomer))
router.patch('/:id', asyncHandler(updateCustomer))
router.post('/:id/status', asyncHandler(updateCustomerStatus))
router.post('/:id/addresses', asyncHandler(addAddress))
router.delete('/:id/addresses/:addressId', asyncHandler(deleteAddress))
router.post('/:id/notes', asyncHandler(addNote))

export default router
