'use client'

import Link from 'next/link'
import { categories as allCategories } from '../data/shop'

// Chỉ danh mục có ảnh mới lên trang chủ; các nhóm khác (sơn tường, bảng hiệu, đồ gỗ...) xem ở menu Sản phẩm.
const categories = allCategories.filter((c) => c.image)

export default function CategoryGrid() {
  return (
    <section className="container category-grid" aria-label="Danh mục sản phẩm">
      {categories.map((c) => (
        <Link key={c.id} className={`cat-card photo-${c.photoStyle}`} href={`/products?category=${c.id}`}>
          <span className="cat-photo-wrap">
            <img className="cat-photo" src={c.image} alt="" loading="lazy" decoding="async" />
          </span>
          <span className="cat-row">
            <span className="cat-name">{c.name}</span>
            <span className="cat-go" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M8 7h9v9" /></svg>
            </span>
          </span>
        </Link>
      ))}
    </section>
  )
}
