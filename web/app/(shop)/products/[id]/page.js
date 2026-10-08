import { notFound } from 'next/navigation'
import ProductDetail from '@/ui/pages/ProductDetail'
import { products as bundled } from '@/ui/data/shop'
import { fetchProduct } from '@/lib/server'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

// Backend tắt thì thử bản đóng gói sẵn; không có ở cả hai nơi mới là 404 thật.
async function load(id) {
  return (await fetchProduct(id)) || bundled.find((p) => p.id === id) || null
}

const clean = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n)

export async function generateMetadata({ params }) {
  const { id } = await params
  const product = await load(id)
  if (!product) return { title: 'Không tìm thấy sản phẩm', robots: { index: false } }
  return {
    title: product.name,
    description: clean(product.description || product.name, 155),
    alternates: { canonical: `/products/${product.id}` },
    openGraph: { type: 'website', title: product.name, description: clean(product.description || product.name, 155), images: product.image ? [product.image] : undefined },
  }
}

export default async function ProductPage({ params }) {
  const { id } = await params
  const product = await load(id)
  if (!product) notFound()

  const inStock = !product.variants?.length || product.variants.some((v) => v.stock > 0)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: (product.images?.length ? product.images : [product.image]).filter(Boolean).slice(0, 6),
    description: clean(product.description || product.name, 500),
    sku: product.shopeeId || product.id,
    brand: { '@type': 'Brand', name: 'CLEVINUM' },
    offers: {
      '@type': product.priceMax ? 'AggregateOffer' : 'Offer',
      priceCurrency: 'VND',
      ...(product.priceMax ? { lowPrice: product.price, highPrice: product.priceMax } : { price: product.price }),
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: `${SITE_URL}/products/${product.id}`,
    },
  }
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <ProductDetail />
    </>
  )
}
