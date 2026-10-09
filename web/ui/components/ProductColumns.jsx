'use client'

import { Link } from '@/lib/router'
import { categories } from '../data/shop'
import { useProducts } from '../data/liveProducts'
import PriceOld from './PriceOld'

function formatPrice(n) {
  return n.toLocaleString('vi-VN') + 'đ'
}

export default function ProductColumns() {
  const products = useProducts()
  const COLUMNS = categories.slice(0, 3).map((c) => ({
    title: c.name,
    items: products.filter((p) => p.categoryId === c.id).slice(0, 3),
  }))
  return (
    <section className="container product-columns">
      {COLUMNS.map((col) => (
        <div className="product-column" key={col.title}>
          <h3>{col.title}</h3>
          {col.items.map((p) => (
            <Link className="product-row" key={p.id} to={`/products/${p.id}`}>
              <div className="product-row-thumb">
                <img src={p.image} alt={p.name} loading="lazy" />
              </div>
              <div className="product-row-info">
                <span className="product-row-name">{p.name}</span>
                <span className="product-row-price">
                  {p.priceMax ? 'Từ ' : ''}
                  {formatPrice(p.price)}
                  <PriceOld product={p} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      ))}
    </section>
  )
}
