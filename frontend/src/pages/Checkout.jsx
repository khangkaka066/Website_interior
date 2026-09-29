import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { useCart } from '../context/CartContext'
import { api } from '../api'
import { trackEvent, getAttribution } from '../analytics'

function formatPrice(n) {
  return n.toLocaleString('vi-VN') + 'đ'
}

const SHIPPING_FEE = 25000

export default function Checkout() {
  const { items, totalPrice, clear } = useCart()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    addressLine: '',
    ward: '',
    district: '',
    province: '',
    paymentMethod: 'COD',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (items.length > 0) trackEvent('CHECKOUT_START')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Cart empties itself right after a successful order, which would
    // otherwise trip this same "no items -> back to cart" guard.
    if (items.length === 0 && !submitted) navigate('/cart', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, submitted])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  const total = totalPrice + SHIPPING_FEE

  async function handleSubmit() {
    if (!form.name || !form.phone || !form.addressLine || !form.province) {
      setError('Vui lòng điền đầy đủ thông tin bắt buộc (*).')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const attribution = getAttribution()
      const order = await api.post('/orders', {
        customer: { name: form.name, phone: form.phone, email: form.email || undefined },
        items: items.map((it) => ({
          productId: it.productId,
          name: it.name,
          variant: it.size || undefined,
          image: it.image,
          quantity: it.quantity,
          unitPrice: it.price,
        })),
        paymentMethod: form.paymentMethod,
        shippingFee: SHIPPING_FEE,
        recipientName: form.name,
        recipientPhone: form.phone,
        addressLine: form.addressLine,
        ward: form.ward,
        district: form.district,
        province: form.province,
        ...attribution,
      })

      trackEvent('PURCHASE', { orderId: order.id })
      setSubmitted(true)
      clear()
      navigate(`/order-confirmation/${order.orderNumber}`)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  if (items.length === 0) return null

  return (
    <>
      <Header />
      <main>
        <div className="container checkout-page">
          <Link to="/cart" className="pdp-back">
            ← Quay lại giỏ hàng
          </Link>
          <h1 className="cart-title">Thanh toán</h1>

          <div className="checkout-layout">
            <div className="checkout-form">
              <h3 className="checkout-section-title">Thông tin nhận hàng</h3>
              <div className="checkout-form-grid">
                <div className="checkout-field">
                  <label>Họ tên *</label>
                  <input value={form.name} onChange={(e) => update('name', e.target.value)} />
                </div>
                <div className="checkout-field">
                  <label>Số điện thoại *</label>
                  <input value={form.phone} onChange={(e) => update('phone', e.target.value)} />
                </div>
                <div className="checkout-field full">
                  <label>Email</label>
                  <input value={form.email} onChange={(e) => update('email', e.target.value)} />
                </div>
                <div className="checkout-field full">
                  <label>Địa chỉ *</label>
                  <input value={form.addressLine} onChange={(e) => update('addressLine', e.target.value)} />
                </div>
                <div className="checkout-field">
                  <label>Phường/Xã</label>
                  <input value={form.ward} onChange={(e) => update('ward', e.target.value)} />
                </div>
                <div className="checkout-field">
                  <label>Quận/Huyện</label>
                  <input value={form.district} onChange={(e) => update('district', e.target.value)} />
                </div>
                <div className="checkout-field">
                  <label>Tỉnh/Thành phố *</label>
                  <input value={form.province} onChange={(e) => update('province', e.target.value)} />
                </div>
              </div>

              <h3 className="checkout-section-title" style={{ marginTop: '24px' }}>Phương thức thanh toán</h3>
              <div className="checkout-payment-options">
                <label className={`checkout-payment-option ${form.paymentMethod === 'COD' ? 'active' : ''}`}>
                  <input type="radio" checked={form.paymentMethod === 'COD'} onChange={() => update('paymentMethod', 'COD')} />
                  Thanh toán khi nhận hàng (COD)
                </label>
                <label className={`checkout-payment-option ${form.paymentMethod === 'Chuyển khoản' ? 'active' : ''}`}>
                  <input type="radio" checked={form.paymentMethod === 'Chuyển khoản'} onChange={() => update('paymentMethod', 'Chuyển khoản')} />
                  Chuyển khoản ngân hàng
                </label>
              </div>

              {error && <p className="chat-error" style={{ marginTop: '16px' }}>{error}</p>}
            </div>

            <div className="cart-summary">
              <h3>Đơn hàng của bạn</h3>
              {items.map((it) => (
                <div className="checkout-summary-item" key={`${it.productId}-${it.size}`}>
                  <span>{it.name} × {it.quantity}</span>
                  <strong>{formatPrice(it.price * it.quantity)}</strong>
                </div>
              ))}
              <div className="cart-summary-row">
                <span>Tạm tính</span>
                <strong>{formatPrice(totalPrice)}</strong>
              </div>
              <div className="cart-summary-row">
                <span>Phí vận chuyển</span>
                <strong>{formatPrice(SHIPPING_FEE)}</strong>
              </div>
              <div className="cart-summary-row cart-summary-total">
                <span>Tổng cộng</span>
                <strong>{formatPrice(total)}</strong>
              </div>
              <button className="btn btn-accent cart-checkout-btn" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Đang đặt hàng...' : 'Đặt hàng'}
              </button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
