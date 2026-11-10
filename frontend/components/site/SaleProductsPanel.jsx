import Link from 'next/link'
import { fetchProducts } from '@/lib/server'
import { formatVnd } from '@/lib/format'
import { productPath } from '@/ui/utils/productUrl'

// Panel “Đang giảm giá” ở bên phải bài viết: các sản phẩm đang có giá gốc cao hơn giá bán, xếp theo % giảm cao nhất.
// Không có sản phẩm nào đang giảm thì không vẽ gì. Là Server Component, dữ liệu làm mới tối đa 30 giây một lần.
// Tên sản phẩm trên Shopee hay mở đầu bằng tên màu trong ngoặc, ví dụ “(Hồng phấn ngọt ngào) Rèm cửa…”: bỏ phần đó để phần tên chính không bị cắt mất.
const shortName = (name) => name.replace(/^\s*\([^)]*\)\s*/, '').trim() || name

export default async function SaleProductsPanel({ limit = 4 }) {
  const all = (await fetchProducts()) || []
  const onSale = all
    .filter((p) => p.originalPrice && p.originalPrice > p.price && p.discountPercent > 0)
    .sort((a, b) => b.discountPercent - a.discountPercent)
    .slice(0, limit)
  if (onSale.length === 0) return null

  return (
    <aside aria-label="Sản phẩm đang giảm giá" className="rounded-xl border border-line bg-white p-4">
      <h2 className="text-lg font-bold">Đang giảm giá</h2>
      <ul className="mt-3 grid gap-4">
        {onSale.map((p) => (
          <li key={p.id}>
            <Link href={productPath(p)} className="group flex gap-3">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt={shortName(p.name)} loading="lazy" className="h-full w-full object-cover" />
                <span className="absolute left-0 top-0 rounded-br-lg bg-red-600 px-1.5 py-0.5 text-[11px] font-bold text-white">-{p.discountPercent}%</span>
              </div>
              <div className="min-w-0">
                <p className="line-clamp-3 text-sm font-medium leading-snug group-hover:underline">{shortName(p.name)}</p>
                <p className="mt-1 text-sm font-bold text-red-600">{formatVnd(p.price)}</p>
                <p className="text-xs text-muted line-through">{formatVnd(p.originalPrice)}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/san-pham" className="mt-4 block text-center text-sm font-semibold text-accent hover:underline">Xem tất cả sản phẩm →</Link>
    </aside>
  )
}
