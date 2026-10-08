import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { postEvent, getOverview, getFunnel, getAdsPerformance, getInsights } from '../controllers/analytics.js'
import { requirePermission } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { analyticsEventSchema } from '../schemas/admin.js'
import { analyticsLimiter } from '../middleware/security.js'

const router = Router()
const guard = requirePermission('analytics')

// Public — storefront tracking must work for anonymous visitors.
router.post('/events', analyticsLimiter, validate(analyticsEventSchema), asyncHandler(postEvent))

router.get('/overview', guard, asyncHandler(getOverview))
router.get('/funnel', guard, asyncHandler(getFunnel))
router.get('/ads-performance', guard, asyncHandler(getAdsPerformance))
router.get('/insights', guard, asyncHandler(getInsights))

export default router
