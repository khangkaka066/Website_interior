import { Suspense } from 'react'
import AllProducts from '@/ui/pages/AllProducts'
import { categories } from '@/ui/data/shop'
import { PRODUCT_GROUPS } from '@/ui/data/menu'

// Tên các danh mục (khớp với ?category= trong menu): mỗi danh mục là một trang đích riêng cho Google (tiêu đề, mô tả, canonical riêng).
const CATEGORY_PAGES = {
  ...Object.fromEntries(categories.map((c) => [c.id, { name: c.name }])),
  ...Object.fromEntries(PRODUCT_GROUPS.filter((g) => g.categoryId).map((g) => [g.categoryId, { name: g.title, items: g.items }])),
}

const first = (v) => (Array.isArray(v) ? v[0] : v || '').trim()

// Tìm kiếm (?q=) và các bộ lọc khác không cho Google lập chỉ mục: vô số biến thể trùng nội dung.
// Riêng ?category=<mã hợp lệ> là trang danh mục thật: có tiêu đề/mô tả/canonical riêng và nằm trong sitemap.
export async function generateMetadata({ searchParams }) {
  const sp = await searchParams
  const query = first(sp.q)
  const category = CATEGORY_PAGES[first(sp.category)] ? first(sp.category) : ''
  const base = {
    description: 'Rèm cửa và phụ kiện rèm CLEVINUM giá xưởng: rèm ore, rèm dán tường, rèm voan, thanh treo. Lọc theo giá, màu, kích thước.',
    alternates: { canonical: '/products' },
  }
  if (query) return { ...base, title: `Tìm “${query}”`, robots: { index: false, follow: true } }
  if (category) {
    const { name, items } = CATEGORY_PAGES[category]
    const title = `${name} giá xưởng`
    const description = `${name}${items ? ` (${items.join(', ')})` : ''} tại CLEVINUM: giá xưởng, nhiều mẫu mã, giao hàng toàn quốc. Xem giá và đặt hàng online.`
    return {
      title,
      description,
      alternates: { canonical: `/products?category=${category}` },
      openGraph: { type: 'website', title, description, url: `/products?category=${category}`, images: [{ url: '/images/curtains/room-blue.webp', alt: title }] },
      // Có thêm bộ lọc/sắp xếp khác trên cùng danh mục thì không lập chỉ mục (canonical đã trỏ về trang danh mục sạch).
      ...(Object.keys(sp).some((k) => k !== 'category') && { robots: { index: false, follow: true } }),
    }
  }
  return {
    ...base,
    title: 'Tất cả sản phẩm',
    ...(Object.keys(sp).length > 0 && { robots: { index: false, follow: true } }),
  }
}

export default function ProductsPage() {
  return (
    <Suspense>
      <AllProducts />
    </Suspense>
  )
}
