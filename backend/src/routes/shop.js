import { Router } from 'express'
import { shopInfo, categories } from '../data/shop.js'
import { getStorefrontProducts, getStorefrontProduct } from '../lib/productStore.js'
import { listPublicPosts, getPublicPost } from '../controllers/posts.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { getSettings, getPublicPaymentOptions, getPublicContent } from '../lib/settingsStore.js'
import { productReviews, reviewSummaries } from '../lib/orderFlow.js'
import { checkCoupon, CouponError } from '../lib/coupons.js'
import { couponCheckSchema } from '../schemas/coupons.js'
import { quoteLimiter } from '../middleware/security.js'
import { goshipConfigured, isGoshipId, listCities, listDistricts, listWards, GoshipError } from '../lib/goship.js'

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

// Danh sách tỉnh / quận-huyện / phường-xã theo Goship (mã khớp với mã Goship cần khi tính cước, tạo vận đơn).
// Chưa cấu hình GOSHIP_TOKEN hoặc Goship lỗi thì trả 503/502: form địa chỉ tự chuyển sang ô gõ tay.
const location = (load) => async (req, res) => {
  if (!goshipConfigured()) return res.status(503).json({ error: 'Chưa cấu hình danh sách địa chỉ.' })
  const id = req.params.cityId ?? req.params.districtId
  if (id !== undefined && !isGoshipId(id)) return res.status(400).json({ error: 'Mã địa danh không hợp lệ.' })
  try {
    res.set('Cache-Control', 'public, max-age=3600')
    res.json(await load(id))
  } catch (err) {
    if (!(err instanceof GoshipError)) throw err
    res.set('Cache-Control', 'no-store')
    res.status(err.status).json({ error: 'Không tải được danh sách địa chỉ, vui lòng thử lại.' })
  }
}
router.get('/locations/cities', asyncHandler(location(() => listCities())))
router.get('/locations/cities/:cityId/districts', asyncHandler(location(listDistricts)))
router.get('/locations/districts/:districtId/wards', asyncHandler(location(listWards)))

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

// Đánh giá của khách đã nhận hàng cho một sản phẩm (công khai, tên đã che).
// Điểm sao trung bình của mọi sản phẩm (hiện trên thẻ sản phẩm). Cho phép cache ngắn vì chỉ là con số tổng hợp.
router.get('/ratings', asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'public, max-age=60')
  res.json(await reviewSummaries())
}))

// Khách thử mã giảm giá ở trang thanh toán: trả số tiền giảm (kiểm tra lại đầy đủ khi đặt hàng, kể cả lượt dùng của riêng khách).
router.post('/coupons/check', quoteLimiter, validate(couponCheckSchema), asyncHandler(async (req, res) => {
  try {
    const { coupon, discount } = await checkCoupon(req.body.code, req.body.subtotal)
    res.json({ code: coupon.code, description: coupon.description, discount })
  } catch (err) {
    if (err instanceof CouponError) return res.status(400).json({ error: err.message })
    throw err
  }
}))

router.get('/products/:id/reviews', REVALIDATE, asyncHandler(async (req, res) => {
  if (!getStorefrontProduct(req.params.id)) return res.status(404).json({ error: 'Không tìm thấy sản phẩm.' })
  res.json(await productReviews(req.params.id))
}))

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
