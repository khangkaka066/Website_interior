import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  createAdSet,
  updateAdSet,
  deleteAdSet,
  createAd,
  updateAd,
  deleteAd,
} from '../controllers/campaigns.js'
import { requirePermission } from '../middleware/auth.js'

const router = Router()
router.use(requirePermission('campaigns'))

router.get('/', asyncHandler(listCampaigns))
router.post('/', asyncHandler(createCampaign))
router.get('/:id', asyncHandler(getCampaign))
router.patch('/:id', asyncHandler(updateCampaign))
router.delete('/:id', asyncHandler(deleteCampaign))

router.post('/:id/adsets', asyncHandler(createAdSet))
router.patch('/:id/adsets/:adSetId', asyncHandler(updateAdSet))
router.delete('/:id/adsets/:adSetId', asyncHandler(deleteAdSet))

router.post('/:id/adsets/:adSetId/ads', asyncHandler(createAd))
router.patch('/:id/adsets/:adSetId/ads/:adId', asyncHandler(updateAd))
router.delete('/:id/adsets/:adSetId/ads/:adId', asyncHandler(deleteAd))

export default router
