'use client'

import Link from 'next/link'
import { categories as allCategories } from '../data/shop'

// Chỉ danh mục có ảnh mới lên lưới trang chủ; các nhóm khác (sơn tường, bảng hiệu, đồ gỗ...) xem ở menu Sản phẩm.
const categories = allCategories.filter((c) => c.image)

export default function CategoryGrid() {
  const [tall, big, ...rest] = categories

  return (
    <section className="container category-grid">
      <Link className={`cat-card cat-tall bg-${tall.bg} photo-${tall.photoStyle}`} href={`/products?category=${tall.id}`}>
        <img className="cat-photo" src={tall.image} alt={tall.name} loading="lazy" decoding="async" />
        <div className="cat-card-scrim" />
        <div className="cat-card-body">
          <h4>{tall.name}</h4>
          <span className="cat-link">XEM THÊM →</span>
        </div>
      </Link>

      <Link className={`cat-card cat-big bg-${big.bg} photo-${big.photoStyle}`} href={`/products?category=${big.id}`}>
        <img className="cat-photo" src={big.image} alt={big.name} loading="lazy" decoding="async" />
        <div className="cat-card-scrim" />
        <div className="cat-card-body">
          <h3>{big.name}</h3>
          <span className="cat-link">XEM THÊM →</span>
        </div>
      </Link>

      <div className="cat-stack">
        {rest.map((c) => (
          <Link key={c.id} className={`cat-card cat-small bg-${c.bg} photo-${c.photoStyle}`} href={`/products?category=${c.id}`}>
            <img className="cat-photo" src={c.image} alt={c.name} loading="lazy" decoding="async" />
            <div className="cat-card-scrim" />
            <div className="cat-card-body">
              <h4>{c.name}</h4>
              <span className="cat-link">XEM THÊM →</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
