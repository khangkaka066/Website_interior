import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { requireMainAdmin } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { getSettings, saveSettings } from '../lib/settingsStore.js'
import { storeSchema, paymentSchema, shippingSchema, contentSchema } from '../schemas/settings.js'

const router = Router()

// Cài đặt cửa hàng chỉ Main Admin được xem và sửa (có thông tin tài khoản ngân hàng).
router.get('/', requireMainAdmin, asyncHandler(async (req, res) => res.json(await getSettings())))
for (const [key, schema] of [['store', storeSchema], ['payment', paymentSchema], ['shipping', shippingSchema], ['content', contentSchema]]) {
  router.put(`/${key}`, requireMainAdmin, validate(schema), asyncHandler(async (req, res) => {
    const next = await saveSettings({ [key]: req.body })
    res.json(next[key])
  }))
}

export default router
