import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { products, categories } from '../data/shop'
import { useCart } from '../context/CartContext'
import { trackEvent } from '../analytics'

function formatPrice(n) {
  return n.toLocaleString('vi-VN') + 'đ'
}

const ACCORDION_SECTIONS = [
  { id: 'info', label: 'Thông tin sản phẩm', field: 'description' },
  { id: 'features', label: 'Ưu điểm', field: 'features' },
  { id: 'material', label: 'Chất liệu', field: 'material' },
]

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const product = products.find((p) => p.id === id)

  const { addItem } = useCart()
  const [activeImage, setActiveImage] = useState(0)
  const [selectedSize, setSelectedSize] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [openSection, setOpenSection] = useState('info')
  const [added, setAdded] = useState(false)

  if (!product) {
    return (
      <>
        <Header />
        <main>
          <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
            <p>Không tìm thấy sản phẩm.</p>
            <button className="btn btn-accent" onClick={() => navigate('/products')}>
              Về danh sách sản phẩm
            </button>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  const gallery = product.images && product.images.length > 0 ? product.images : [product.image]
  const category = categories.find((c) => c.id === product.categoryId)
  const salePrice = product.discount ? Math.round(product.price / (1 - product.discount / 100)) : null

  return (
    <>
      <Header />
      <main>
        <div className="container pdp">
          <Link to="/products" className="pdp-back">
            ← Tất cả sản phẩm
          </Link>

          <div className="pdp-layout">
            <div className="pdp-gallery">
              <div className="pdp-thumbs">
                {gallery.map((img, idx) => (
                  <button
                    key={img + idx}
                    className={`pdp-thumb ${activeImage === idx ? 'pdp-thumb-active' : ''}`}
                    onClick={() => setActiveImage(idx)}
                  >
                    <img src={img} alt={`${product.name} ${idx + 1}`} />
                  </button>
                ))}
              </div>
              <div className="pdp-main-image">
                <img src={gallery[activeImage]} alt={product.name} />
              </div>
            </div>

            <div className="pdp-info">
              {category && <span className="pdp-category">{category.name}</span>}
              <h1 className="pdp-name">{product.name}</h1>
              <div className="pdp-price-row">
                <span className="pdp-price">{formatPrice(product.price)}</span>
                {salePrice && <span className="pdp-price-old">{formatPrice(salePrice)}</span>}
                {product.discount ? <span className="badge badge-discount">-{product.discount}%</span> : null}
              </div>
              <div className="pdp-rating">
                ★ {product.rating} · {product.sold} đã bán
              </div>

              <p className="pdp-description">{product.description}</p>

              {product.sizes && product.sizes.length > 0 && (
                <div className="pdp-size-block">
                  <span className="pdp-block-label">Kích thước</span>
                  <div className="pdp-size-options">
                    {product.sizes.map((size, idx) => (
                      <button
                        key={size}
                        className={`pdp-size-pill ${selectedSize === idx ? 'pdp-size-pill-active' : ''}`}
                        onClick={() => setSelectedSize(idx)}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pdp-purchase-row">
                <div className="pdp-qty">
                  <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Giảm số lượng">
                    −
                  </button>
                  <span>{quantity}</span>
                  <button onClick={() => setQuantity((q) => q + 1)} aria-label="Tăng số lượng">
                    +
                  </button>
                </div>
                <button
                  className="btn pdp-add-to-cart"
                  onClick={() => {
                    addItem(product, { size: product.sizes?.[selectedSize], quantity })
                    trackEvent('ADD_TO_CART', { productId: product.id })
                    setAdded(true)
                    setTimeout(() => setAdded(false), 2000)
                  }}
                >
                  Thêm vào giỏ hàng
                </button>
              </div>
              {added && <p className="pdp-added-note">Đã thêm vào giỏ hàng — <Link to="/cart">xem giỏ hàng →</Link></p>}

              <a href="#shipping-info" className="pdp-shipping-link">
                Vận chuyển, đổi trả & bảo hành
              </a>

              <div className="pdp-accordion">
                {ACCORDION_SECTIONS.map((section) => {
                  const value = product[section.field]
                  if (!value) return null
                  const isOpen = openSection === section.id
                  return (
                    <div className="pdp-accordion-item" key={section.id}>
                      <button
                        className="pdp-accordion-head"
                        onClick={() => setOpenSection(isOpen ? null : section.id)}
                      >
                        <span>{section.label}</span>
                        <span className="pdp-accordion-icon">{isOpen ? '−' : '+'}</span>
                      </button>
                      {isOpen && (
                        <div className="pdp-accordion-body">
                          {Array.isArray(value) ? (
                            <ul>
                              {value.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          ) : (
                            <p>{value}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
