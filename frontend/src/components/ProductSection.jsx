import { useState } from 'react'
import { Link } from 'react-router-dom'
import { products } from '../data/shop'

const TABS = [
  { id: 'new', label: 'SẢN PHẨM MỚI' },
  { id: 'best', label: 'BÁN CHẠY' },
  { id: 'latest', label: 'MỚI NHẤT' },
]

function formatPrice(n) {
  return n.toLocaleString('vi-VN') + 'đ'
}

export default function ProductSection() {
  const [active, setActive] = useState('new')
  const filtered = products.filter((p) => p.tab === active)
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
          <div className="product-card" key={p.id}>
            {p.discount >= 40 && <span className="badge badge-discount card-badge">-{p.discount}%</span>}
            <div className="product-thumb">
              <img src={p.image} alt={p.name} />
            </div>
            <h4>{p.name}</h4>
            <div className="product-meta">
              <span className="price">{formatPrice(p.price)}</span>
              <span className="rating">★ {p.rating} · {p.sold} đã bán</span>
            </div>
          </div>
        ))}
      </div>

      <Link className="view-all-link" to="/products">
        Xem tất cả sản phẩm →
      </Link>
    </section>
  )
}
