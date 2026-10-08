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
import { validate } from '../middleware/validate.js'
import { requirePermission } from '../middleware/auth.js'

import { createCampaignSchema, updateCampaignSchema, createAdSetSchema, updateAdSetSchema, createAdSchema, updateAdSchema } from '../schemas/admin.js'

const router = Router()
router.use(requirePermission('campaigns'))

router.get('/', asyncHandler(listCampaigns))
router.post('/', validate(createCampaignSchema), asyncHandler(createCampaign))
router.get('/:id', asyncHandler(getCampaign))
router.patch('/:id', validate(updateCampaignSchema), asyncHandler(updateCampaign))
router.delete('/:id', asyncHandler(deleteCampaign))

router.post('/:id/adsets', validate(createAdSetSchema), asyncHandler(createAdSet))
router.patch('/:id/adsets/:adSetId', validate(updateAdSetSchema), asyncHandler(updateAdSet))
router.delete('/:id/adsets/:adSetId', asyncHandler(deleteAdSet))

router.post('/:id/adsets/:adSetId/ads', validate(createAdSchema), asyncHandler(createAd))
router.patch('/:id/adsets/:adSetId/ads/:adId', validate(updateAdSchema), asyncHandler(updateAd))
router.delete('/:id/adsets/:adSetId/ads/:adId', asyncHandler(deleteAd))

export default router
