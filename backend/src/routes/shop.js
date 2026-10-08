import { Router } from 'express'
import { shopInfo, categories } from '../data/shop.js'
import { getStorefrontProducts, getStorefrontProduct } from '../lib/productStore.js'
import { listPublicPosts, getPublicPost } from '../controllers/posts.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { getSettings, getPublicPaymentOptions, getPublicContent } from '../lib/settingsStore.js'

const router = Router()

// Dữ liệu cửa hàng là file tĩnh, chỉ đổi khi deploy lại: cho trình duyệt/CDN giữ bản cũ ít phút,
// hết hạn thì vẫn dùng tạm bản cũ trong lúc tải lại ngầm (stale-while-revalidate). ETag của Express
// cho phép 304 khi dữ liệu không đổi.
const cache = (seconds) => (req, res, next) => {
  res.set('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds * 2}`)
  next()
}
const LONG = cache(3600) // thông tin shop, danh mục: 1 giờ

router.get('/info', async (req, res) => {
  const { store } = await getSettings()
  res.set('Cache-Control', 'public, max-age=60')
  res.json({ ...shopInfo, name: store.name, tagline: store.tagline, hotline: store.hotline, address: store.address })
})

// Nội dung trang Về chúng tôi / Liên hệ / FAQ + thông tin cửa hàng, sửa được ở Cài đặt.
router.get('/content', async (req, res) => {
  res.set('Cache-Control', 'public, max-age=60')
  res.json(await getPublicContent())
})

// Phương thức thanh toán đang bật + phí vận chuyển (cấu hình ở Cài đặt) cho trang thanh toán.
router.get('/payment-options', async (req, res) => {
  res.set('Cache-Control', 'public, max-age=30')
  res.json(await getPublicPaymentOptions())
})

router.get('/categories', LONG, (req, res) => {
  res.json(categories)
})

// Sản phẩm đổi khi admin nhập Excel/sửa giá: luôn hỏi lại server (ETag nên không đổi thì trả 304, rất nhẹ).
const REVALIDATE = (req, res, next) => {
  res.set('Cache-Control', 'no-cache')
  next()
}

router.get('/products', REVALIDATE, (req, res) => {
  res.json(getStorefrontProducts())
})

router.get('/products/:id', REVALIDATE, (req, res) => {
  const product = getStorefrontProduct(req.params.id)
  if (!product) {
    res.set('Cache-Control', 'no-store') // không cache lỗi 404
    return res.status(404).json({ error: 'Không tìm thấy sản phẩm.' })
  }
  res.json(product)
})

// Tin tức công khai (chỉ bài đã xuất bản). Luôn hỏi lại server để bài mới/đã gỡ thấy ngay (ETag nên không đổi thì trả 304).
router.get('/posts', REVALIDATE, asyncHandler(listPublicPosts))
router.get('/posts/:slug', REVALIDATE, asyncHandler(getPublicPost))

export default router
