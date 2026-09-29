import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { listUsers, updateUserRole } from '../controllers/users.js'
import { requireMainAdmin } from '../middleware/auth.js'

const router = Router()

router.get('/', requireMainAdmin, asyncHandler(listUsers))
router.patch('/:id/role', requireMainAdmin, asyncHandler(updateUserRole))

export default router
