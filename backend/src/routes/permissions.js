import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { listPermissions, updatePermission } from '../controllers/permissions.js'
import { requireRole, requireMainAdmin } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { permissionSchema } from '../schemas/admin.js'

const router = Router()

router.get('/', requireRole('ADMIN'), asyncHandler(listPermissions))
router.patch('/:key', requireMainAdmin, validate(permissionSchema), asyncHandler(updatePermission))

export default router
