'use client'

import { useState, useEffect } from 'react'
import { useNavigate, Link } from '@/lib/router'
import { useCart } from '../context/CartContext'
import { api } from '../api'
import { trackEvent, getAttribution } from '../analytics'
import { pixelTrack } from '../pixels'
import TransferQr from '../components/TransferQr'
import { fillTransferNote } from '../utils/vietqr'
import AddressFields from '../components/AddressFields'
import { useShippingQuote, defaultShippingOption } from '../utils/useShippingQuote'

// Ô nhập có nhãn của form thanh toán (đặt ngoài component để không bị dựng lại mỗi lần gõ).
function CheckoutField({ label, children }) {
  return (
    <div className="checkout-field">
      <label>{label}</label>
      {children}
    </div>
  )
}

function formatPrice(n) {
  return n.toLocaleString('vi-VN') + 'đ'
}

// Dự phòng khi chưa tải được cấu hình từ máy chủ (giống mặc định ở trang Cài đặt).
const FALLBACK_OPTIONS = {
  methods: [
    { id: 'COD', label: 'Thanh toán khi nhận hàng (COD)' },
    { id: 'Chuyển khoản', label: 'Chuyển khoản ngân hàng' },
  ],
  shipping: { fee: 0, freeShippingOver: 0 },
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
  const [couponInput, setCouponInput] = useState('')
  const [coupon, setCoupon] = useState(null) // { code, description, discount } sau khi áp mã thành công
  const [couponError, setCouponError] = useState('')
  const [couponBusy, setCouponBusy] = useState(false)

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
    if (hydrated && items.length > 0) {
      trackEvent('CHECKOUT_START')
      pixelTrack('CHECKOUT_START', { value: totalPrice, items: items.map((i) => ({ id: i.productId, name: i.name, price: i.price, quantity: i.quantity })) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated])

  useEffect(() => {
    // Cart empties itself right after a successful order, which would
    // otherwise trip this same "no items -> back to cart" guard.
    if (hydrated && items.length === 0 && !submitted) navigate('/cart', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, items.length, submitted])

  async function applyCoupon(code, { silent = false } = {}) {
    if (!code.trim()) return
    setCouponBusy(true)
    if (!silent) setCouponError('')
    try {
      const res = await api.post('/shop/coupons/check', { code, subtotal: totalPrice })
      setCoupon(res)
      setCouponInput('')
      setCouponError('')
    } catch (err) {
      setCoupon(null)
      setCouponError(err.message)
    } finally {
      setCouponBusy(false)
    }
  }

  // Giỏ hàng đổi (thêm/bớt hàng) thì kiểm tra lại mã đang áp: số tiền giảm có thể đổi, hoặc không còn đủ đơn tối thiểu.
  useEffect(() => {
    if (coupon) applyCoupon(coupon.code, { silent: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPrice])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  const methods = (options || FALLBACK_OPTIONS).methods
  const { fee, freeShippingOver } = (options || FALLBACK_OPTIONS).shipping
  const fixedFee = freeShippingOver > 0 && totalPrice >= freeShippingOver ? 0 : fee
  const quote = useShippingQuote({ items, paymentMethod: form.paymentMethod, province: form.province, district: form.district, ward: form.ward })
  const picked = quote.status === 'ok' ? defaultShippingOption(quote.options) : null // khách không chọn hãng: luôn dùng Best Inc (tài khoản riêng của shop nếu có), hãng này không báo giá cho địa chỉ thì lấy lựa chọn rẻ nhất
  const shippingFee = picked ? picked.fee : fixedFee
  const couponDiscount = coupon ? Math.min(coupon.discount, totalPrice) : 0
  const total = totalPrice - couponDiscount + shippingFee
  // 0đ có hai nghĩa: miễn phí thật hoặc chưa có cước nào để tính. "Miễn phí" chỉ hiện khi đã có kết quả cụ thể (Goship báo 0đ, hoặc đã
  // xét xong địa chỉ mà đơn đủ mức miễn phí); trước khi khách chọn đủ địa chỉ thì luôn là "Chưa tính".
  const freeByRule = freeShippingOver > 0 && totalPrice >= freeShippingOver
  const isFree = (quote.status === 'ok' && picked) || (quote.status === 'fixed' && freeByRule)
  const shippingLabel = shippingFee > 0 ? formatPrice(shippingFee) : isFree ? 'Miễn phí' : quote.status === 'loading' ? 'Đang tính…' : 'Chưa tính'
  const selectedMethod = methods.find((m) => m.id === form.paymentMethod)

  async function handleSubmit() {
    const required = [
      ['name', 'họ tên'],
      ['phone', 'số điện thoại'],
      ['addressLine', 'địa chỉ'],
      ['province', 'tỉnh/thành phố'],
      ['district', 'quận/huyện'],
      ['ward', 'phường/xã'],
    ]
    const missing = required.filter(([key]) => !form[key].trim()).map(([, label]) => label)
    if (missing.length > 0) {
      setError(`Vui lòng điền đầy đủ thông tin bắt buộc (*): ${missing.join(', ')}.`)
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
        shippingRateId: picked?.id,
        couponCode: coupon?.code,
        ...attribution,
      })

      trackEvent('PURCHASE', { orderId: order.id })
      pixelTrack('PURCHASE', { value: Number(order.total), orderId: order.orderNumber, items: items.map((i) => ({ id: i.productId, name: i.name, price: i.price, quantity: i.quantity })) })
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
      if (err.data?.code === 'COUPON_INVALID') setCoupon(null) // mã vừa hết hiệu lực: bỏ mã, khách đặt lại
      if (err.data?.code === 'SHIPPING_CHANGED') quote.refresh() // cước vừa đổi: hỏi lại để khách chọn đúng lựa chọn mới
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
                  <input value={form.name} onChange={(e) => update('name', e.target.value)} autoComplete="name" />
                </div>
                <div className="checkout-field">
                  <label>Số điện thoại *</label>
                  <input value={form.phone} onChange={(e) => update('phone', e.target.value)} autoComplete="tel" inputMode="tel" />
                </div>
                <div className="checkout-field full">
                  <label>Email</label>
                  <input value={form.email} onChange={(e) => update('email', e.target.value)} autoComplete="email" inputMode="email" />
                </div>
                <div className="checkout-field full">
                  <label>Địa chỉ *</label>
                  <input value={form.addressLine} onChange={(e) => update('addressLine', e.target.value)} autoComplete="street-address" placeholder="Số nhà, tên đường" />
                </div>
                <AddressFields value={form} onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} Field={CheckoutField} />
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
              <div className="coupon-box">
                {coupon ? (
                  <div className="coupon-applied">
                    <span>🏷️ <strong>{coupon.code}</strong>{coupon.description ? ` · ${coupon.description}` : ''}</span>
                    <button type="button" className="coupon-remove" onClick={() => setCoupon(null)} aria-label="Bỏ mã giảm giá">Bỏ</button>
                  </div>
                ) : (
                  <form
                    className="coupon-form"
                    onSubmit={(e) => {
                      e.preventDefault()
                      applyCoupon(couponInput)
                    }}
                  >
                    <input value={couponInput} onChange={(e) => setCouponInput(e.target.value)} placeholder="Mã giảm giá" maxLength={40} aria-label="Mã giảm giá" autoCapitalize="characters" />
                    <button type="submit" className="btn" disabled={couponBusy || !couponInput.trim()}>{couponBusy ? '…' : 'Áp dụng'}</button>
                  </form>
                )}
                {couponError && <p className="coupon-error" role="alert">{couponError}</p>}
              </div>
              {couponDiscount > 0 && (
                <div className="cart-summary-row">
                  <span>Giảm giá</span>
                  <strong className="coupon-discount">-{formatPrice(couponDiscount)}</strong>
                </div>
              )}
              <div className="cart-summary-row">
                <span>Phí vận chuyển</span>
                <strong>{shippingLabel}</strong>
              </div>
              <div className="cart-summary-row cart-summary-total">
                <span>Tổng cộng</span>
                <strong>{formatPrice(total)}</strong>
              </div>
              <button className="btn btn-accent cart-checkout-btn" onClick={handleSubmit} disabled={submitting || quote.status === 'loading'}>
                {submitting ? 'Đang đặt hàng...' : 'Đặt hàng'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
