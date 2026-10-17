'use client'

import { useState } from 'react'
import { Link } from '@/lib/router'
import { categories } from '../data/shop'
import { useProducts } from '../data/liveProducts'
import ProductHoverCard from './ProductHoverCard'
import Words from './Words'

// Chỉ danh mục có ảnh (nhóm rèm) làm tab ở trang chủ; các nhóm khác xem ở menu Sản phẩm.
const TABS = categories.filter((c) => c.image).map((c) => ({ id: c.id, label: c.name.toUpperCase() }))

export default function ProductSection() {
  const products = useProducts()
  const [active, setActive] = useState(TABS[0]?.id)
  const filtered = products.filter((p) => p.categoryId === active)
  const shown = filtered.length ? filtered : products.slice(0, 4)

  return (
    <section className="container product-section" id="products">
      <h2 className="section-title"><Words text="Sản phẩm của chúng tôi" /></h2>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${active === t.id ? 'tab-active' : ''}`}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="product-grid">
        {shown.slice(0, 4).map((p) => (
          <ProductHoverCard key={p.id} product={p} />
        ))}
      </div>

      <Link className="view-all-link" to="/products">
        Xem tất cả sản phẩm →
      </Link>
    </section>
  )
}
