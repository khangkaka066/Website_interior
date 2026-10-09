import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { requirePermission } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { getSettings, saveSettings } from '../lib/settingsStore.js'
import { loadProducts, getCodeInfo } from '../lib/productStore.js'
import { discountsSchema, importSchema } from '../schemas/discounts.js'
import { analyzeImport } from '../lib/discountImport.js'

// Giảm giá theo mã: admin nhập SKU / Mã Shopee (sản phẩm) / mã phân loại + phần trăm. Mã sản phẩm giảm mọi phân loại, mã phân loại chỉ giảm
// phân loại đó. Website hiện giá đã giảm và tính tiền theo giá đó.
const router = Router()
const guard = requirePermission('products')

// Dạng lưu cũ là { sku, variantId }: đọc thành { code }.
const codeOf = (r) => r.code ?? r.variantId ?? r.sku

async function view() {
  const { rules } = (await getSettings()).discounts
  return {
    rules: rules.map((r) => {
      const code = codeOf(r)
      const info = getCodeInfo(code)
      return {
        code,
        percent: r.percent,
        originalPrice: r.originalPrice || null,
        salePrice: r.salePrice || null,
        found: !!info,
        ...(info && {
          kind: info.kind,
          name: info.name,
          label: info.label || null,
          sku: info.sku || null,
          variantId: info.variantId || null,
          catalogPrice: info.price,
          // Quy tắc từ file có giá cố định: giá gốc/giá bán lấy đúng theo file.
          price: r.salePrice ? r.originalPrice || info.price : info.price,
          discountedPrice: r.salePrice || Math.max(1, Math.round(info.price * (1 - r.percent / 100))),
        }),
      }
    }),
  }
}

router.get('/', guard, asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json(await view())
}))

// Thay toàn bộ danh sách. Mã phải có trong kho sản phẩm (gõ sai thì báo ngay thay vì lặng lẽ không giảm), và hai dòng không được cùng trỏ
// tới một sản phẩm/phân loại (ví dụ nhập cả SKU lẫn Mã Shopee của cùng một sản phẩm).
router.put('/', guard, validate(discountsSchema), asyncHandler(async (req, res) => {
  const seen = new Map()
  for (const { code } of req.body.rules) {
    const info = getCodeInfo(code)
    if (!info) return res.status(400).json({ error: `Không tìm thấy mã "${code}" trong kho sản phẩm (SKU, Mã Shopee hoặc mã phân loại).` })
    if (seen.has(info.target)) return res.status(400).json({ error: `Mã "${code}" và "${seen.get(info.target)}" cùng trỏ tới một ${info.kind === 'variant' ? 'phân loại' : 'sản phẩm'}.` })
    seen.set(info.target, code)
  }
  await saveSettings({ discounts: { rules: req.body.rules } })
  await loadProducts() // website thấy giá mới ngay
  res.json(await view())
}))

// Nhập từ file Excel (trình duyệt đọc file rồi gửi các dòng lên). apply=false: xem trước từng dòng; apply=true: áp dụng các dòng hợp lệ.
router.post('/import', guard, validate(importSchema), asyncHandler(async (req, res) => {
  const { rules: existing } = (await getSettings()).discounts
  const { results, rules, summary } = analyzeImport(req.body.rows, existing)
  if (req.body.apply) {
    if (summary.ok + summary.clear > 0) {
      await saveSettings({ discounts: { rules } })
      await loadProducts()
    }
    return res.json({ applied: true, summary, results })
  }
  res.json({ applied: false, summary, results })
}))

export default router
