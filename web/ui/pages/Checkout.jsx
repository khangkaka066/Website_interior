'use client'

import { useState, useEffect } from 'react'
import { useNavigate, Link } from '@/lib/router'
import { useCart } from '../context/CartContext'
import { api } from '../api'
import { trackEvent, getAttribution } from '../analytics'
import TransferQr from '../components/TransferQr'
import { fillTransferNote } from '../utils/vietqr'

function formatPrice(n) {
  return n.toLocaleString('vi-VN') + 'đ'
}

// Dự phòng khi chưa tải được cấu hình từ máy chủ (giống mặc định ở trang Cài đặt).
const FALLBACK_OPTIONS = {
  methods: [
    { id: 'COD', label: 'Thanh toán khi nhận hàng (COD)' },
    { id: 'Chuyển khoản', label: 'Chuyển khoản ngân hàng' },
  ],
  shipping: { fee: 25000, freeShippingOver: 0 },
}

export default function Checkout() {
  const { items, hydrated, totalPrice, clear } = useCart()
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
  const [options, setOptions] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get('/shop/payment-options')
      .then((o) => {
        setOptions(o)
        // phương thức đang chọn bị tắt trong Cài đặt thì chuyển sang phương thức đầu tiên còn bật
        setForm((f) => (o.methods.some((m) => m.id === f.paymentMethod) ? f : { ...f, paymentMethod: o.methods[0]?.id || f.paymentMethod }))
      })
      .catch(() => setOptions(FALLBACK_OPTIONS))
  }, [])

  useEffect(() => {
    if (hydrated && items.length > 0) trackEvent('CHECKOUT_START')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated])

  useEffect(() => {
    // Cart empties itself right after a successful order, which would
    // otherwise trip this same "no items -> back to cart" guard.
    if (hydrated && items.length === 0 && !submitted) navigate('/cart', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, items.length, submitted])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  const methods = (options || FALLBACK_OPTIONS).methods
  const { fee, freeShippingOver } = (options || FALLBACK_OPTIONS).shipping
  const shippingFee = freeShippingOver > 0 && totalPrice >= freeShippingOver ? 0 : fee
  const total = totalPrice + shippingFee
  const selectedMethod = methods.find((m) => m.id === form.paymentMethod)

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
        recipientName: form.name,
        recipientPhone: form.phone,
        addressLine: form.addressLine,
        ward: form.ward,
        district: form.district,
        province: form.province,
        ...attribution,
      })

      trackEvent('PURCHASE', { orderId: order.id })
      try {
        // trang xác nhận dùng để hiện lại mã QR (đúng số tiền máy chủ đã tính và mã đơn)
        sessionStorage.setItem(`clevinum_order_${order.orderNumber}`, JSON.stringify({ paymentMethod: form.paymentMethod, total: Number(order.total) }))
      } catch {
        // không lưu được thì trang xác nhận chỉ không hiện QR
      }
      setSubmitted(true)
      clear()
      // Thanh toán online (PayOS): chuyển sang trang thanh toán; xong PayOS đưa khách về trang xác nhận đơn.
      if (order.paymentUrl) {
        window.location.href = order.paymentUrl
        return
      }
      navigate(`/order-confirmation/${order.orderNumber}`)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  if (items.length === 0) return null

  return (
    <>
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
                {methods.map((m) => (
                  <label key={m.id} className={`checkout-payment-option ${form.paymentMethod === m.id ? 'active' : ''}`}>
                    <input type="radio" checked={form.paymentMethod === m.id} onChange={() => update('paymentMethod', m.id)} />
                    {m.label}
                  </label>
                ))}
              </div>
              {selectedMethod?.bank && selectedMethod.bank.bankCode && selectedMethod.bank.accountNumber ? (
                <div className="checkout-bank-info">
                  <TransferQr
                    bank={selectedMethod.bank}
                    amount={total}
                    note={fillTransferNote(selectedMethod.bank.transferNote, form.phone.replace(/\D/g, ''))}
                    footnote="Bạn có thể chuyển khoản ngay, hoặc đặt hàng trước: sau khi đặt, hệ thống hiện mã QR kèm mã đơn hàng của bạn."
                  />
                </div>
              ) : (
                selectedMethod?.bank && (selectedMethod.bank.bankName || selectedMethod.bank.accountNumber) && (
                  <div className="checkout-bank-info">
                    {selectedMethod.bank.bankName && <div>Ngân hàng: <strong>{selectedMethod.bank.bankName}</strong></div>}
                    {selectedMethod.bank.accountNumber && <div>Số tài khoản: <strong>{selectedMethod.bank.accountNumber}</strong></div>}
                    {selectedMethod.bank.accountHolder && <div>Chủ tài khoản: <strong>{selectedMethod.bank.accountHolder}</strong></div>}
                  </div>
                )
              )}

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
                <strong>{shippingFee === 0 ? 'Miễn phí' : formatPrice(shippingFee)}</strong>
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
    </>
  )
}
