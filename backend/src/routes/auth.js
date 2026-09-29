import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { register, login, googleLogin, me } from '../controllers/auth.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.post('/register', asyncHandler(register))
router.post('/login', asyncHandler(login))
router.post('/google', asyncHandler(googleLogin))
router.get('/me', requireAuth, asyncHandler(me))

export default router
