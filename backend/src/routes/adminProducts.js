import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { requirePermission } from '../middleware/auth.js'
import { getAdminProductsState, applyProductChanges } from '../lib/productStore.js'

// Kho sản phẩm của trang quản trị (nhập Excel, sửa giá...). Lưu ở database để website bán hàng thấy ngay.
const router = Router()
const guard = requirePermission('products')
const MAX_CHANGES = 5000
const MAX_PRICE = 120000000 // khớp giới hạn giá khi nhập Excel
const MAX_PRODUCT_BYTES = 2_000_000

router.get(
  '/',
  guard,
  asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store')
    res.json(await getAdminProductsState())
  }),
)

// Chỉ gửi phần đổi: { upserts: [sản phẩm...], deletes: [id...] }.
router.post(
  '/sync',
  guard,
  asyncHandler(async (req, res) => {
    const { upserts = [], deletes = [] } = req.body || {}
    if (!Array.isArray(upserts) || !Array.isArray(deletes) || upserts.length + deletes.length > MAX_CHANGES) {
      return res.status(400).json({ error: 'Dữ liệu sản phẩm không hợp lệ.' })
    }
    const ids = new Set()
    for (const p of upserts) {
      if (!p || typeof p.id !== 'string' || !p.id || typeof p.name !== 'string' || ids.has(p.id)) {
        return res.status(400).json({ error: 'Có sản phẩm thiếu mã/tên hoặc bị trùng mã.' })
      }
      if (p.id.length > 200 || p.name.length > 500) return res.status(400).json({ error: 'Mã hoặc tên sản phẩm quá dài.' })
      if (!['active', 'hidden', 'draft'].includes(p.status ?? 'active')) {
        return res.status(400).json({ error: `Trạng thái sản phẩm "${p.name.slice(0, 40)}" không hợp lệ.` })
      }
      if (p.price != null && !(Number.isFinite(Number(p.price)) && Number(p.price) >= 0 && Number(p.price) <= MAX_PRICE)) {
        return res.status(400).json({ error: `Giá của "${p.name.slice(0, 40)}" không hợp lệ.` })
      }
      if (JSON.stringify(p).length > MAX_PRODUCT_BYTES) {
        return res.status(400).json({ error: `Sản phẩm "${p.name.slice(0, 40)}" quá lớn.` })
      }
      ids.add(p.id)
    }
    if (deletes.some((id) => typeof id !== 'string')) return res.status(400).json({ error: 'Danh sách xóa không hợp lệ.' })
    try {
      await applyProductChanges({ upserts, deletes })
    } catch (err) {
      if (err.code === 'P2002' || String(err.message).includes('Product_shopeeId_key')) return res.status(409).json({ error: 'Trùng Mã Shopee với một sản phẩm khác.' })
      throw err
    }
    res.json({ ok: true, upserted: upserts.length, deleted: deletes.length })
  }),
)

export default router
