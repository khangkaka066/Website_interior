import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { listPermissions, updatePermission } from '../controllers/permissions.js'
import { requireRole, requireMainAdmin } from '../middleware/auth.js'

const router = Router()

router.get('/', requireRole('ADMIN'), asyncHandler(listPermissions))
router.patch('/:key', requireMainAdmin, asyncHandler(updatePermission))

export default router
