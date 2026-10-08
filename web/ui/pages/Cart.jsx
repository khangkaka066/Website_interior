'use client'

import { Link, useNavigate } from '@/lib/router'
import { useCart } from '../context/CartContext'

function formatPrice(n) {
  return n.toLocaleString('vi-VN') + 'đ'
}

export default function Cart() {
  const { items, hydrated, updateQuantity, removeItem, totalPrice, lineKey } = useCart()
  const navigate = useNavigate()

  return (
    <>
      <main>
        <div className="container cart-page">
          <h1 className="cart-title">Giỏ hàng của bạn</h1>

          {!hydrated ? null : items.length === 0 ? (
            <div className="cart-empty">
              <p>Giỏ hàng đang trống.</p>
              <Link to="/products" className="btn btn-accent">
                Tiếp tục mua sắm
              </Link>
            </div>
          ) : (
            <div className="cart-layout">
              <div className="cart-items">
                {items.map((it) => {
                  const key = lineKey(it)
                  return (
                    <div className="cart-row" key={key}>
                      <img src={it.image} alt={it.name} className="cart-row-image" loading="lazy" decoding="async" />
                      <div className="cart-row-info">
                        <span className="cart-row-name">{it.name}</span>
                        {it.size && <span className="cart-row-size">Kích thước: {it.size}</span>}
                        <span className="cart-row-price">{formatPrice(it.price)}</span>
                      </div>
                      <div className="pdp-qty">
                        <button onClick={() => updateQuantity(key, it.quantity - 1)}>−</button>
                        <span>{it.quantity}</span>
                        <button onClick={() => updateQuantity(key, it.quantity + 1)}>+</button>
                      </div>
                      <span className="cart-row-total">{formatPrice(it.price * it.quantity)}</span>
                      <button className="cart-row-remove" onClick={() => removeItem(key)} aria-label="Xóa">
                        ✕
                      </button>
                    </div>
                  )
                })}
              </div>

              <div className="cart-summary">
                <h3>Tóm tắt đơn hàng</h3>
                <div className="cart-summary-row">
                  <span>Tạm tính</span>
                  <strong>{formatPrice(totalPrice)}</strong>
                </div>
                <p className="cart-summary-note">Phí vận chuyển sẽ được tính ở bước thanh toán.</p>
                <button className="btn btn-accent cart-checkout-btn" onClick={() => navigate('/checkout')}>
                  Tiến hành thanh toán
                </button>
                <Link to="/products" className="cart-continue-link">
                  ← Tiếp tục mua sắm
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
