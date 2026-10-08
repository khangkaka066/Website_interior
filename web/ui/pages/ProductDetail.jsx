'use client'

import { useState } from 'react'
import { useParams, useNavigate, Link } from '@/lib/router'
import { categories } from '../data/shop'
import { useProducts } from '../data/liveProducts'
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
  const products = useProducts()
  const product = products.find((p) => p.id === id)
  const inStock = !product?.variants?.length || product.variants.some((v) => v.stock > 0)

  const { addItem } = useCart()
  const [activeImage, setActiveImage] = useState(0)
  // true khi khách vừa bấm một ảnh nhỏ: khi đó ảnh lớn là ảnh đó, không bị ảnh của màu đang chọn đè lên
  const [galleryPinned, setGalleryPinned] = useState(false)
  const [picked, setPicked] = useState({}) // { [tên nhóm]: giá trị đã chọn }
  const [quantity, setQuantity] = useState(1)
  const [openSection, setOpenSection] = useState('info')
  const [added, setAdded] = useState(false)

  if (!product) {
    return (
      <>
        <main>
          <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
            <p>Không tìm thấy sản phẩm.</p>
            <button className="btn btn-accent" onClick={() => navigate('/products')}>
              Về danh sách sản phẩm
            </button>
          </div>
        </main>
      </>
    )
  }

  const options = product.options || []
  const selection = options.map((o) => picked[o.name] ?? o.values[0])
  const variant = product.variants?.find((v) => v.label === selection.join(' / ')) || null
  const optionImage = options[0]?.images?.[selection[0]] || null
  const price = variant?.price ?? product.price
  const outOfStock = variant ? variant.stock <= 0 : false
  const gallery = product.images && product.images.length > 0 ? product.images : [product.image]
  const mainImage = (!galleryPinned && optionImage) || gallery[activeImage] || gallery[0]
  const shortDescription = product.description
    ? product.description.length > 220
      ? product.description.slice(0, 220).replace(/\s+\S*$/, '') + '…'
      : product.description
    : ''
  const category = categories.find((c) => c.id === product.categoryId)
  const salePrice = product.discount ? Math.round(price / (1 - product.discount / 100)) : null

  return (
    <>
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
                    className={`pdp-thumb ${mainImage === img ? 'pdp-thumb-active' : ''}`}
                    onClick={() => {
                      setActiveImage(idx)
                      setGalleryPinned(true)
                    }}
                  >
                    <img src={img} alt={`${product.name} ${idx + 1}`} loading="lazy" decoding="async" />
                  </button>
                ))}
              </div>
              <div className="pdp-main-image">
                <img src={mainImage} alt={product.name} />
              </div>
            </div>

            <div className="pdp-info">
              {category && <span className="pdp-category">{category.name}</span>}
              <h1 className="pdp-name">{product.name}</h1>
              <div className="pdp-price-row">
                <span className="pdp-price">{formatPrice(price)}</span>
                {salePrice && <span className="pdp-price-old">{formatPrice(salePrice)}</span>}
                {product.discount ? <span className="badge badge-discount">-{product.discount}%</span> : null}
              </div>
              {product.rating ? (
                <div className="pdp-rating">
                  ★ {product.rating}
                  {product.sold ? ` · ${product.sold} đã bán` : ''}
                </div>
              ) : null}

              {shortDescription && <p className="pdp-description">{shortDescription}</p>}

              {options.map((opt, i) => (
                <div className="pdp-size-block" key={opt.name}>
                  <span className="pdp-block-label">{opt.name}</span>
                  <div className="pdp-size-options">
                    {opt.values.map((val) => (
                      <button
                        key={val}
                        className={`pdp-size-pill ${selection[i] === val ? 'pdp-size-pill-active' : ''}`}
                        onClick={() => {
                          setPicked({ ...picked, [opt.name]: val })
                          setGalleryPinned(false) // chọn màu thì hiện ảnh của màu đó
                        }}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {variant && (
                <p className="pdp-stock-note" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  {outOfStock ? 'Phân loại này tạm hết hàng.' : 'Còn hàng'}
                </p>
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
                  disabled={outOfStock}
                  onClick={() => {
                    addItem(product, { size: variant?.label, quantity, price, image: optionImage || undefined })
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
                            <p style={{ whiteSpace: 'pre-line' }}>{value}</p>
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
    </>
  )
}
