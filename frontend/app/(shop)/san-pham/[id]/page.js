import { notFound, permanentRedirect } from 'next/navigation'
import ProductDetail from '@/ui/pages/ProductDetail'
import { products as bundled } from '@/ui/data/shop'
import { fetchProduct, fetchReviews } from '@/lib/server'
import { SITE_URL } from '@/lib/site'
import { productPath, productParam, findProductByParam } from '@/ui/utils/productUrl'
import ProductReviews from '@/ui/components/ProductReviews'
import { categories } from '@/ui/data/shop'


// `id` trên địa chỉ là "<tên-không-dấu>-<mã>" (hoặc chỉ "<mã>" của địa chỉ cũ): backend và findProductByParam đều tra được cả hai dạng.
// Backend tắt thì thử bản đóng gói sẵn; không có ở cả hai nơi mới là 404 thật.
async function load(param) {
  return (await fetchProduct(param)) || findProductByParam(bundled, param) || null
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
  if (product.seo?.metaDescription) return product.seo.metaDescription
  const base = clean(product.description, 400)
  const price = product.contactOnly
    ? 'Giá liên hệ để được báo giá.'
    : product.originalPrice
    ? `Giá ${vnd(product.price)} (giảm ${product.discountPercent}%).`
    : `Giá ${product.priceMax ? 'từ ' : ''}${vnd(product.price)}.`
  const lead = `${cut(product.name, 90)} — ${price}`
  return cut(base ? `${lead} ${base}` : `${lead} Giá xưởng, giao hàng toàn quốc tại CLEVINIUM.`, 158)
}

export async function generateMetadata({ params }) {
  const { id } = await params
  const product = await load(id)
  if (!product) return { title: 'Không tìm thấy sản phẩm', robots: { index: false } }
  const title = product.seo?.metaTitle || cut(product.name, 62)
  const description = describe(product)
  const images = (product.images?.length ? product.images : [product.image]).filter(Boolean).slice(0, 4)
  return {
    title,
    description,
    alternates: { canonical: productPath(product) },
    openGraph: { type: 'website', title, description, url: productPath(product), images: images.map((url) => ({ url, alt: product.name })) },
    twitter: { card: 'summary_large_image', title, description, images: images.slice(0, 1) },
    ...(!product.contactOnly && { other: { 'product:price:amount': String(product.price), 'product:price:currency': 'VND' } }),
  }
}

export default async function ProductPage({ params }) {
  const { id } = await params
  const product = await load(id)
  if (!product) notFound()
  // Địa chỉ chuẩn là /san-pham/<tên>-<mã>: địa chỉ cũ (chỉ mã, hoặc tên cũ) chuyển hướng 308 để Google chỉ giữ một địa chỉ cho mỗi sản phẩm.
  if (decodeURIComponent(id) !== productParam(product)) permanentRedirect(productPath(product))

  const reviews = await fetchReviews(product.id)
  const inStock = !product.variants?.length || product.variants.some((v) => v.stock > 0)
  const url = `${SITE_URL}${productPath(product)}`
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
      brand: { '@type': 'Brand', name: 'CLEVINIUM' },
      // Chỉ khai báo khi có đánh giá thật của khách đã nhận hàng.
      ...(reviews?.count > 0 && { aggregateRating: { '@type': 'AggregateRating', ratingValue: reviews.average, reviewCount: reviews.count, bestRating: 5, worstRating: 1 } }),
      ...(!product.contactOnly && { offers: {
        '@type': product.priceMax ? 'AggregateOffer' : 'Offer',
        priceCurrency: 'VND',
        ...(product.priceMax ? { lowPrice: product.price, highPrice: product.priceMax, offerCount: product.variants?.length || 1 } : { price: product.price }),
        priceValidUntil: nextYear,
        itemCondition: 'https://schema.org/NewCondition',
        availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        url,
        seller: { '@type': 'Organization', name: 'CLEVINIUM' },
      } }),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Sản phẩm', item: `${SITE_URL}/san-pham` },
        ...(category ? [{ '@type': 'ListItem', position: 3, name: category.name, item: `${SITE_URL}/san-pham?category=${category.id}` }] : []),
        { '@type': 'ListItem', position: category ? 4 : 3, name: cut(product.name, 80), item: url },
      ],
    },
  ]
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <ProductDetail initialProduct={product} reviewSummary={reviews} />
      <ProductReviews reviews={reviews} />
    </>
  )
}
