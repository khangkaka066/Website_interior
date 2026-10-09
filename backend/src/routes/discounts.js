import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { requirePermission } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { getSettings, saveSettings } from '../lib/settingsStore.js'
import { loadProducts, getSkuInfo, normSku } from '../lib/productStore.js'
import { discountsSchema } from '../schemas/discounts.js'

// Giảm giá theo SKU: admin nhập SKU + phần trăm, website tự hiện giá đã giảm và tính tiền theo giá đó.
const router = Router()
const guard = requirePermission('products')

async function view() {
  const { rules } = (await getSettings()).discounts
  return {
    rules: rules.map(({ sku, percent }) => {
      const info = getSkuInfo(sku)
      return {
        sku,
        percent,
        found: !!info,
        ...(info && {
          kind: info.kind,
          name: info.name,
          label: info.label || null,
          price: info.price,
          discountedPrice: Math.max(1, Math.round(info.price * (1 - percent / 100))),
        }),
      }
    }),
  }
}

router.get('/', guard, asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json(await view())
}))

// Thay toàn bộ danh sách. SKU phải có trong kho sản phẩm (gõ sai thì báo ngay thay vì lặng lẽ không giảm).
router.put('/', guard, validate(discountsSchema), asyncHandler(async (req, res) => {
  const seen = new Set()
  for (const { sku } of req.body.rules) {
    const key = normSku(sku)
    if (seen.has(key)) return res.status(400).json({ error: `SKU "${sku}" bị nhập trùng.` })
    seen.add(key)
    if (!getSkuInfo(sku)) return res.status(400).json({ error: `Không tìm thấy SKU "${sku}" trong kho sản phẩm.` })
  }
  await saveSettings({ discounts: { rules: req.body.rules } })
  await loadProducts() // website thấy giá mới ngay
  res.json(await view())
}))

export default router
