import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { postEvent, getOverview, getFunnel, getAdsPerformance, getInsights } from '../controllers/analytics.js'

const router = Router()

router.post('/events', asyncHandler(postEvent))
router.get('/overview', asyncHandler(getOverview))
router.get('/funnel', asyncHandler(getFunnel))
router.get('/ads-performance', asyncHandler(getAdsPerformance))
router.get('/insights', asyncHandler(getInsights))

export default router
