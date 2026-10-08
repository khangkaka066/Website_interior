import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { listUsers, updateUserRole } from '../controllers/users.js'
import { validate } from '../middleware/validate.js'
import { requireMainAdmin } from '../middleware/auth.js'

import { userRoleSchema } from '../schemas/admin.js'

const router = Router()

router.get('/', requireMainAdmin, asyncHandler(listUsers))
router.patch('/:id/role', requireMainAdmin, validate(userRoleSchema), asyncHandler(updateUserRole))

export default router
