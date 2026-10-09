import { notFound } from 'next/navigation'
import ProductDetail from '@/ui/pages/ProductDetail'
import { products as bundled } from '@/ui/data/shop'
import { fetchProduct } from '@/lib/server'
import { categories } from '@/ui/data/shop'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

// Backend tắt thì thử bản đóng gói sẵn; không có ở cả hai nơi mới là 404 thật.
async function load(id) {
  return (await fetchProduct(id)) || bundled.find((p) => p.id === id) || null
}

// Bỏ emoji/ký hiệu trang trí (✔️ ✨ ...) trong mô tả nhập từ Shopee: không đẹp trên kết quả tìm kiếm.
const clean = (s, n) =>
  String(s || '')
    .replace(/[\u2190-\u2BFF\uFE0F\u200D\u{1F000}-\u{1FFFF}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, n)
// Cắt ở ranh giới từ, không để câu cụt giữa chừng. Tên sản phẩm Shopee thường dài 100-150 ký tự: tiêu đề tìm kiếm chỉ hiện ~60.
const cut = (s, n) => {
  const t = clean(s, 1000)
  if (t.length <= n) return t
  return t.slice(0, n).replace(/\s+\S*$/, '').replace(/[\s,.\-–—|(]+$/, '') + '…'
}
const vnd = (n) => `${Number(n).toLocaleString('vi-VN')}đ`

// Mô tả hiển thị trên kết quả tìm kiếm: ưu tiên mô tả thật; thiếu thì ghép từ tên + giá + cam kết để không bỏ trống.
function describe(product) {
  const base = clean(product.description, 400)
  const price = product.originalPrice
    ? `Giá ${vnd(product.price)} (giảm ${product.discountPercent}%).`
    : `Giá ${product.priceMax ? 'từ ' : ''}${vnd(product.price)}.`
  const lead = `${cut(product.name, 90)} — ${price}`
  return cut(base ? `${lead} ${base}` : `${lead} Giá xưởng, giao hàng toàn quốc tại CLEVINUM.`, 158)
}

export async function generateMetadata({ params }) {
  const { id } = await params
  const product = await load(id)
  if (!product) return { title: 'Không tìm thấy sản phẩm', robots: { index: false } }
  const title = cut(product.name, 62)
  const description = describe(product)
  const images = (product.images?.length ? product.images : [product.image]).filter(Boolean).slice(0, 4)
  return {
    title,
    description,
    alternates: { canonical: `/products/${product.id}` },
    openGraph: { type: 'website', title, description, url: `/products/${product.id}`, images: images.map((url) => ({ url, alt: product.name })) },
    twitter: { card: 'summary_large_image', title, description, images: images.slice(0, 1) },
    other: { 'product:price:amount': String(product.price), 'product:price:currency': 'VND' },
  }
}

export default async function ProductPage({ params }) {
  const { id } = await params
  const product = await load(id)
  if (!product) notFound()

  const inStock = !product.variants?.length || product.variants.some((v) => v.stock > 0)
  const url = `${SITE_URL}/products/${product.id}`
  const category = categories.find((c) => c.id === product.categoryId)
  const nextYear = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      '@id': `${url}#product`,
      name: product.name,
      url,
      image: (product.images?.length ? product.images : [product.image]).filter(Boolean).slice(0, 6),
      description: clean(product.description || product.name, 500),
      sku: product.shopeeId || product.id,
      mpn: product.shopeeId || product.id,
      ...(category && { category: category.name }),
      brand: { '@type': 'Brand', name: 'CLEVINUM' },
      offers: {
        '@type': product.priceMax ? 'AggregateOffer' : 'Offer',
        priceCurrency: 'VND',
        ...(product.priceMax ? { lowPrice: product.price, highPrice: product.priceMax, offerCount: product.variants?.length || 1 } : { price: product.price }),
        priceValidUntil: nextYear,
        itemCondition: 'https://schema.org/NewCondition',
        availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        url,
        seller: { '@type': 'Organization', name: 'CLEVINUM' },
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Sản phẩm', item: `${SITE_URL}/products` },
        ...(category ? [{ '@type': 'ListItem', position: 3, name: category.name, item: `${SITE_URL}/products?category=${category.id}` }] : []),
        { '@type': 'ListItem', position: category ? 4 : 3, name: cut(product.name, 80), item: url },
      ],
    },
  ]
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <ProductDetail initialProduct={product} />
    </>
  )
}
