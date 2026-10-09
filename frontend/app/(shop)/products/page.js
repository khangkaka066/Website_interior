import { Suspense } from 'react'
import AllProducts from '@/ui/pages/AllProducts'

// Trang kết quả tìm kiếm (?q=) không cho Google lập chỉ mục: vô số biến thể trùng nội dung.
export async function generateMetadata({ searchParams }) {
  const { q } = await searchParams
  const query = (Array.isArray(q) ? q[0] : q || '').trim()
  return {
    title: query ? `Tìm “${query}”` : 'Tất cả sản phẩm',
    description: 'Rèm cửa và phụ kiện rèm CLEVINUM giá xưởng: rèm ore, rèm dán tường, rèm voan, thanh treo. Lọc theo giá, màu, kích thước.',
    alternates: { canonical: '/products' },
    robots: query ? { index: false, follow: true } : undefined,
  }
}

export default function ProductsPage() {
  return (
    <Suspense>
      <AllProducts />
    </Suspense>
  )
}
