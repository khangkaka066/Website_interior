import { Router } from 'express'
import { getStorefrontProducts } from '../lib/productStore.js'
import { shopUrl } from '../lib/mailer.js'
import { prisma } from '../lib/prisma.js'

// robots.txt và sitemap.xml cho công cụ tìm kiếm. Địa chỉ gốc lấy từ SHOP_URL; khi deploy, trỏ
// <tên-miền-web>/robots.txt và /sitemap.xml về backend (hoặc proxy 2 đường dẫn này).
const router = Router()
const xml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c])

router.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /dashboard',
      'Disallow: /cart',
      'Disallow: /checkout',
      'Disallow: /login',
      'Disallow: /forgot-password',
      'Disallow: /reset-password',
      'Disallow: /track-order',
      'Disallow: /order-confirmation/',
      'Disallow: /wishlist',
      `Sitemap: ${shopUrl()}/sitemap.xml`,
      '',
    ].join('\n'),
  )
})

router.get('/sitemap.xml', async (req, res) => {
  const base = shopUrl()
  // Bài viết đã xuất bản; database lỗi thì sitemap vẫn có các trang còn lại.
  const posts = await prisma.post
    .findMany({ where: { status: 'published', publishedAt: { lte: new Date() } }, select: { slug: true } })
    .catch(() => [])
  const urls = [
    '/',
    '/products',
    '/about',
    '/contact',
    '/faq',
    '/news',
    ...getStorefrontProducts().map((p) => `/products/${encodeURIComponent(p.id)}`),
    ...posts.map((p) => `/news/${encodeURIComponent(p.slug)}`),
  ]
  res.set('Cache-Control', 'public, max-age=3600')
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls.map((u) => `  <url><loc>${xml(base + u)}</loc></url>`).join('\n') +
      '\n</urlset>\n',
  )
})

export default router
