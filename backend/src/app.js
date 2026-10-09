import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import shopRoutes from './routes/shop.js'
import authRoutes from './routes/auth.js'
import orderRoutes from './routes/orders.js'
import shippingRoutes from './routes/shipping.js'
import customerRoutes from './routes/customers.js'
import chatRoutes from './routes/chat.js'
import campaignRoutes from './routes/campaigns.js'
import analyticsRoutes from './routes/analytics.js'
import userRoutes from './routes/users.js'
import permissionRoutes from './routes/permissions.js'
import paymentRoutes from './routes/payments.js'
import settingsRoutes from './routes/settings.js'
import adminProductRoutes from './routes/adminProducts.js'
import postRoutes from './routes/posts.js'
import seoRoutes from './routes/seo.js'
import accountRoutes from './routes/account.js'
import discountRoutes from './routes/discounts.js'
import { authenticate } from './middleware/auth.js'
import { securityHeaders, compress, globalLimiter } from './middleware/security.js'

const app = express()

// Sau reverse proxy (nginx, Render, Railway...) đặt TRUST_PROXY=1 để rate limit thấy IP thật của khách.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY)

// Sau proxy/CDN có HTTPS: chuyển mọi truy cập http sang https. Bật bằng FORCE_HTTPS=1 (cần TRUST_PROXY để đọc đúng giao thức).
if (process.env.FORCE_HTTPS) {
  app.use((req, res, next) => {
    if (req.secure) return next()
    res.redirect(308, `https://${req.headers.host}${req.originalUrl}`)
  })
}

app.use(securityHeaders)
app.use(compress)
app.use(globalLimiter)
// FRONTEND_ORIGIN: danh sách origin cách nhau bởi dấu phẩy (app Vite cũ :5173 và app Next :3000).
const origins = (process.env.FRONTEND_ORIGIN || 'http://localhost:3000').split(',').map((s) => s.trim())
app.use(cors({ origin: origins }))
// Kho sản phẩm admin có mô tả + ảnh nên lớn hơn 1mb; parser này chạy trước và bỏ qua parser chung bên dưới.
app.use('/api/admin-products', express.json({ limit: '30mb' }))
app.use(express.json({ limit: '1mb' }))
app.use(authenticate)

app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

app.use(seoRoutes) // /robots.txt, /sitemap.xml
app.use('/api/shop', shopRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/account', accountRoutes)
app.use('/api/discounts', discountRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/shipping', shippingRoutes)
app.use('/api/customers', customerRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/campaigns', campaignRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/users', userRoutes)
app.use('/api/permissions', permissionRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/admin-products', adminProductRoutes)
app.use('/api/posts', postRoutes)

// Không lộ trang lỗi mặc định của Express ("Cannot GET /...") cho đường dẫn không tồn tại.
app.use((req, res) => {
  res.status(404).json({ error: 'Không tìm thấy.' })
})

// Chi tiết lỗi (stack, câu SQL...) chỉ ghi vào log máy chủ, không bao giờ trả về cho client.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Dữ liệu gửi lên không đọc được.' })
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Dữ liệu gửi lên quá lớn.' })
  console.error(err)
  res.status(500).json({ error: 'Đã có lỗi xảy ra ở máy chủ.' })
})

export default app
