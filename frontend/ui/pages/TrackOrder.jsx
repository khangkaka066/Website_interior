'use client'

import { useEffect, useState } from 'react'
import { Link, useSearchParams } from '@/lib/router'
import { api } from '../api'
import { ORDER_STATUS, PAYMENT_STATUS } from '../constants/orderStatus'
import { SHIPPING_STATUS } from '../constants/shippingStatus'

const money = (n) => Number(n || 0).toLocaleString('vi-VN') + 'đ'
const when = (d) => new Date(d).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })

// Khách tự tra cứu đơn bằng mã đơn + số điện thoại đặt hàng (không cần tài khoản).
export default function TrackOrder() {
  const [params] = useSearchParams()
  const [orderNumber, setOrderNumber] = useState(params.get('orderNumber') || '')
  const [phone, setPhone] = useState('')
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setOrder(null)
    setLoading(true)
    try {
      const q = new URLSearchParams({ orderNumber: orderNumber.trim(), phone: phone.trim() })
      setOrder(await api.get(`/orders/track?${q}`))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Đơn chọn thanh toán online mà chưa trả tiền: cho khách thanh toán (hoặc thanh toán lại khi link cũ hết hạn).
  const canPayOnline =
    order && order.paymentMethod === 'PAYOS' && order.paymentStatus === 'AWAITING_PAYMENT' && !['CANCELLED', 'RETURNED'].includes(order.status)

  async function payNow() {
    setError('')
    setPaying(true)
    try {
      const { paymentUrl } = await api.post('/orders/payos-link', { orderNumber: order.orderNumber, phone: phone.trim() })
      window.location.href = paymentUrl
    } catch (err) {
      setError(err.message)
      setPaying(false)
    }
  }

  const status = order && ORDER_STATUS[order.status]
  const pay = order && PAYMENT_STATUS[order.paymentStatus]

  return (
    <>
      <main>
        <div className="container track-order">
          <h1>Tra cứu đơn hàng</h1>
          <p className="track-intro">Nhập mã đơn hàng (dạng ORD-12345) và số điện thoại bạn đã dùng khi đặt hàng.</p>

          <form className="track-form" onSubmit={onSubmit}>
            <input
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="Mã đơn hàng, ví dụ ORD-12345"
              maxLength={30}
              required
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Số điện thoại đặt hàng"
              inputMode="tel"
              maxLength={20}
              required
            />
            <button className="btn btn-accent" disabled={loading}>
              {loading ? 'Đang tra cứu…' : 'Tra cứu'}
            </button>
          </form>

          {error && <p className="track-error">{error}</p>}

          {order && (
            <div className="track-result">
              <div className="track-head">
                <div>
                  <h2>Đơn {order.orderNumber}</h2>
                  <span className="track-date">Đặt lúc {when(order.createdAt)}</span>
                </div>
                <div className="track-badges">
                  <span className={`status-badge ${status?.cls || ''}`}>{status?.label || order.status}</span>
                  <span className={`status-badge ${pay?.cls || ''}`}>{pay?.label || order.paymentStatus}</span>
                </div>
              </div>

              {canPayOnline && (
                <div className="track-pay">
                  <span>Đơn hàng chưa được thanh toán.</span>
                  <button type="button" className="btn btn-accent" onClick={payNow} disabled={paying}>
                    {paying ? 'Đang chuyển…' : 'Thanh toán ngay'}
                  </button>
                </div>
              )}

              <h3>Tiến trình đơn hàng</h3>
              <ol className="track-timeline">
                {order.statusEvents.map((e, i) => (
                  <li key={i}>
                    <strong>{ORDER_STATUS[e.status]?.label || e.status}</strong>
                    <span>{when(e.createdAt)}</span>
                  </li>
                ))}
              </ol>

              {order.shipment && (
                <>
                  <h3>
                    Vận chuyển · {order.shipment.carrier} · Mã vận đơn {order.shipment.trackingId}
                  </h3>
                  <p>Trạng thái: {SHIPPING_STATUS[order.shipment.status]?.label || order.shipment.status}</p>
                  <ol className="track-timeline">
                    {order.shipment.events.map((e, i) => (
                      <li key={i}>
                        <strong>{e.status}</strong>
                        {e.note && <em>{e.note}</em>}
                        <span>
                          {when(e.createdAt)}
                          {e.location ? ` · ${e.location}` : ''}
                        </span>
                      </li>
                    ))}
                  </ol>
                </>
              )}

              <h3>Sản phẩm</h3>
              <ul className="track-items">
                {order.items.map((i, k) => (
                  <li key={k}>
                    {i.image && <img src={i.image} alt="" loading="lazy" />}
                    <div>
                      {i.productId ? <Link to={`/products/${i.productId}`}>{i.name}</Link> : i.name}
                      {i.variant && <small>{i.variant}</small>}
                    </div>
                    <span>
                      {i.quantity} × {money(i.unitPrice)}
                    </span>
                    <strong>{money(i.lineTotal)}</strong>
                  </li>
                ))}
              </ul>

              <dl className="track-totals">
                <div><dt>Tạm tính</dt><dd>{money(order.subtotal)}</dd></div>
                <div><dt>Phí vận chuyển</dt><dd>{money(order.shippingFee)}</dd></div>
                {Number(order.discount) > 0 && <div><dt>Giảm giá</dt><dd>-{money(order.discount)}</dd></div>}
                <div className="track-total"><dt>Tổng cộng</dt><dd>{money(order.total)}</dd></div>
              </dl>

              <p className="track-address">
                Giao tới: <strong>{order.recipientName}</strong>, {[order.addressLine, order.ward, order.district, order.province].filter(Boolean).join(', ')}
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
