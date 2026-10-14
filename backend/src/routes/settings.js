import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { requireMainAdmin } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { getSettings, saveSettings } from '../lib/settingsStore.js'
import { storeSchema, paymentSchema, shippingSchema, contentSchema, ordersSchema } from '../schemas/settings.js'

const router = Router()

// Cài đặt cửa hàng chỉ Main Admin được xem và sửa (có thông tin tài khoản ngân hàng).
router.get('/', requireMainAdmin, asyncHandler(async (req, res) => res.json(await getSettings())))
for (const [key, schema] of [['store', storeSchema], ['payment', paymentSchema], ['shipping', shippingSchema], ['content', contentSchema], ['orders', ordersSchema]]) {
  router.put(`/${key}`, requireMainAdmin, validate(schema), asyncHandler(async (req, res) => {
    const body = key === 'shipping' ? { ...(await getSettings()).shipping, ...req.body } : req.body // client cũ không gửi goship thì giữ nguyên cấu hình đang có
    const next = await saveSettings({ [key]: body })
    res.json(next[key])
  }))
}

export default router
