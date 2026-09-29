import { products } from '../data/shop'

function formatPrice(n) {
  return n.toLocaleString('vi-VN') + 'đ'
}

const COLUMNS = [
  { title: 'Nổi bật', items: products.slice(0, 2) },
  { title: 'Khuyến mãi', items: products.slice(2, 4) },
  { title: 'Phổ biến', items: products.slice(4, 7) },
]

export default function ProductColumns() {
  return (
    <section className="container product-columns">
      {COLUMNS.map((col) => (
        <div className="product-column" key={col.title}>
          <h3>{col.title}</h3>
          {col.items.map((p) => (
            <div className="product-row" key={p.id}>
              <div className="product-row-thumb">
                <img src={p.image} alt={p.name} />
              </div>
              <div className="product-row-info">
                <span className="product-row-name">{p.name}</span>
                <span className="product-row-price">
                  {formatPrice(p.price)}
                  {p.discount >= 40 && (
                    <span className="badge badge-discount">-{p.discount}%</span>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </section>
  )
}
