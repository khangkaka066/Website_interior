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
import { authenticate } from './middleware/auth.js'

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173' }))
app.use(express.json())
app.use(authenticate)

app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

app.use('/api/shop', shopRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/shipping', shippingRoutes)
app.use('/api/customers', customerRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/campaigns', campaignRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/users', userRoutes)
app.use('/api/permissions', permissionRoutes)

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Đã có lỗi xảy ra ở máy chủ.' })
})

app.listen(PORT, () => {
  console.log(`Clevinum backend listening on http://localhost:${PORT}`)
})
