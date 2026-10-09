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
      'Disallow: /account',
      `Sitemap: ${shopUrl()}/sitemap.xml`,
      '',
    ].join('\n'),
  )
})

const day = (d) => {
  const t = d ? new Date(d) : null
  return t && !Number.isNaN(t.getTime()) ? t.toISOString().slice(0, 10) : null
}
const tag = (loc, extra = {}) =>
  `  <url><loc>${xml(loc)}</loc>${extra.lastmod ? `<lastmod>${extra.lastmod}</lastmod>` : ''}` +
  (extra.images || []).map((u) => `<image:image><image:loc>${xml(u)}</image:loc></image:image>`).join('') +
  '</url>'

router.get('/sitemap.xml', async (req, res) => {
  const base = shopUrl()
  // Bài viết đã xuất bản; database lỗi thì sitemap vẫn có các trang còn lại.
  const posts = await prisma.post
    .findMany({ where: { status: 'published', publishedAt: { lte: new Date() } }, select: { slug: true, updatedAt: true } })
    .catch(() => [])
  const products = getStorefrontProducts()
  // Mỗi danh mục có sản phẩm là một trang đích riêng (?category=), xem products/page.js ở frontend.
  const categories = [...new Set(products.map((p) => p.categoryId).filter(Boolean))].sort()
  const entries = [
    ...['/', '/products', '/about', '/contact', '/faq', '/news'].map((u) => tag(base + u)),
    ...categories.map((c) => tag(`${base}/products?category=${encodeURIComponent(c)}`)),
    ...products.map((p) =>
      // Ảnh sản phẩm giúp lên Google Hình ảnh; ảnh phải là địa chỉ đầy đủ (ảnh trong thư mục public của website thì ghép tên miền vào).
      tag(`${base}/products/${encodeURIComponent(p.id)}`, {
        lastmod: day(p.updatedAt || p.createdAt),
        images: (p.images?.length ? p.images : [p.image])
          .filter(Boolean)
          .slice(0, 5)
          .map((u) => (u.startsWith('http') ? u : base + u)),
      }),
    ),
    ...posts.map((p) => tag(`${base}/news/${encodeURIComponent(p.slug)}`, { lastmod: day(p.updatedAt) })),
  ]
  res.set('Cache-Control', 'public, max-age=3600')
  res.type('application/xml').send(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
      entries.join('\n') +
      '\n</urlset>\n',
  )
})

export default router
