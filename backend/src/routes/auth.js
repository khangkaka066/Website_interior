import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { register, login, googleLogin, me, forgotPassword, resetPassword } from '../controllers/auth.js'
import { requireAuth } from '../middleware/auth.js'
import { loginLimiter, registerLimiter, forgotLimiter } from '../middleware/security.js'
import { validate } from '../middleware/validate.js'
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, googleLoginSchema } from '../schemas/auth.js'

const router = Router()

router.post('/register', registerLimiter, validate(registerSchema), asyncHandler(register))
router.post('/login', loginLimiter, validate(loginSchema), asyncHandler(login))
router.post('/forgot-password', forgotLimiter, validate(forgotPasswordSchema), asyncHandler(forgotPassword))
router.post('/reset-password', forgotLimiter, validate(resetPasswordSchema), asyncHandler(resetPassword))
router.post('/google', loginLimiter, validate(googleLoginSchema), asyncHandler(googleLogin))
router.get('/me', requireAuth, asyncHandler(me))

export default router
