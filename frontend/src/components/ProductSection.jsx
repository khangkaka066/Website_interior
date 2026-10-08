import { useState } from 'react'
import { Link } from 'react-router-dom'
import { categories } from '../data/shop'
import { useProducts } from '../data/liveProducts'
import WishlistButton from './WishlistButton'

const TABS = categories.map((c) => ({ id: c.id, label: c.name.toUpperCase() }))

function formatPrice(n) {
  return n.toLocaleString('vi-VN') + 'đ'
}

export default function ProductSection() {
  const products = useProducts()
  const [active, setActive] = useState(TABS[0]?.id)
  const filtered = products.filter((p) => p.categoryId === active)
  const shown = filtered.length ? filtered : products.slice(0, 4)

  return (
    <section className="container product-section" id="products">
      <h2 className="section-title">Sản phẩm của chúng tôi</h2>

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
          <Link className="product-card" key={p.id} to={`/products/${p.id}`}>
            <div className="product-thumb">
              <img src={p.image} alt={p.name} loading="lazy" />
              <WishlistButton productId={p.id} />
            </div>
            <h4>{p.name}</h4>
            <div className="product-meta">
              <span className="price">
                {p.priceMax ? 'Từ ' : ''}
                {formatPrice(p.price)}
              </span>
            </div>
          </Link>
        ))}
      </div>

      <Link className="view-all-link" to="/products">
        Xem tất cả sản phẩm →
      </Link>
    </section>
  )
}
