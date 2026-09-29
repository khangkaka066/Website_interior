import { Router } from 'express'
import { shopInfo, categories, products } from '../data/shop.js'

const router = Router()

router.get('/info', (req, res) => {
  res.json(shopInfo)
})

router.get('/categories', (req, res) => {
  res.json(categories)
})

router.get('/products', (req, res) => {
  res.json(products)
})

router.get('/products/:id', (req, res) => {
  const product = products.find((p) => p.id === req.params.id)
  if (!product) return res.status(404).json({ error: 'Không tìm thấy sản phẩm.' })
  res.json(product)
})

export default router
