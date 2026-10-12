'use client'

import { useEffect, useState } from 'react'
import { Link, useSearchParams } from '@/lib/router'
import { api } from '../api'
import { ORDER_STATUS, PAYMENT_STATUS } from '../constants/orderStatus'
import { SHIPPING_STATUS } from '../constants/shippingStatus'

const money = (n) => Number(n || 0).toLocaleString('vi-VN') + 'đ'
// Đơn đã kết thúc (vào mục Lịch sử); còn lại là đơn đang xử lý.
const FINISHED = ['DELIVERED', 'CANCELLED', 'RETURNED']
const when = (d) => new Date(d).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })

// Khách tự tra cứu đơn bằng mã đơn HOẶC số điện thoại đặt hàng (không cần tài khoản). Nhập cả hai thì xem đầy đủ thông tin giao hàng;
// chỉ nhập một thì tên và địa chỉ nhận hàng được ẩn bớt (chỉ số điện thoại: hiện danh sách đơn để chọn).
export default function TrackOrder() {
  const [params] = useSearchParams()
  const [orderNumber, setOrderNumber] = useState(params.get('orderNumber') || '')
  const [phone, setPhone] = useState('')
  const [order, setOrder] = useState(null)
  const [list, setList] = useState(null) // danh sách đơn khi tra bằng số điện thoại
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  async function lookup(params) {
    setError('')
    setOrder(null)
    setList(null)
    setLoading(true)
    try {
      const data = await api.get(`/orders/track?${new URLSearchParams(params)}`)
      if (data.orders) setList(data.orders)
      else setOrder(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function onSubmit(e) {
    e.preventDefault()
    const params = {}
    if (orderNumber.trim()) params.orderNumber = orderNumber.trim()
    if (phone.trim()) params.phone = phone.trim()
    if (!params.orderNumber && !params.phone) return setError('Vui lòng nhập mã đơn hàng hoặc số điện thoại đặt hàng.')
    lookup(params)
  }

  // Chọn một đơn trong danh sách (tra bằng số điện thoại): xem theo mã đơn, thông tin giao hàng được ẩn bớt.
  function openFromList(number) {
    setOrderNumber(number)
    setPhone('')
    lookup({ orderNumber: number })
  }

  // Đơn chọn thanh toán online mà chưa trả tiền: cho khách thanh toán (hoặc thanh toán lại khi link cũ hết hạn).
  const canPayOnline =
    order && !order.masked && order.paymentMethod === 'PAYOS' && order.paymentStatus === 'AWAITING_PAYMENT' && !['CANCELLED', 'RETURNED'].includes(order.status)

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
          <p className="track-intro">Nhập mã đơn hàng (dạng ORD-12345) <strong>hoặc</strong> số điện thoại bạn đã dùng khi đặt hàng. Nhập cả hai để xem đầy đủ thông tin giao hàng.</p>

          <form className="track-form" onSubmit={onSubmit}>
            <input
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="Mã đơn hàng, ví dụ ORD-12345"
              maxLength={30}
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Số điện thoại đặt hàng"
              inputMode="tel"
              maxLength={20}
            />
            <button className="btn btn-accent" disabled={loading}>
              {loading ? 'Đang tra cứu…' : 'Tra cứu'}
            </button>
          </form>

          {error && <p className="track-error">{error}</p>}

          {list && (
            <div className="track-result">
              {[
                { title: 'Đơn đang xử lý', orders: list.filter((o) => !FINISHED.includes(o.status)) },
                { title: 'Lịch sử đơn hàng', orders: list.filter((o) => FINISHED.includes(o.status)) },
              ].map(
                (g) =>
                  g.orders.length > 0 && (
                    <div key={g.title}>
                      <h3>{g.title}</h3>
                      <ul className="track-items">
                        {g.orders.map((o) => (
                          <li key={o.orderNumber}>
                            <div>
                              <button type="button" className="btn-link" onClick={() => openFromList(o.orderNumber)}>
                                {o.orderNumber}
                              </button>
                              <small>
                                {when(o.createdAt)} · {ORDER_STATUS[o.status]?.label || o.status}
                              </small>
                              <small>{o.items.map((i) => `${i.name}${i.variant ? ` (${i.variant})` : ''} ×${i.quantity}`).join(', ')}</small>
                            </div>
                            <strong>{money(o.total)}</strong>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ),
              )}
            </div>
          )}

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
              {order.masked && <p className="track-intro">Tên và địa chỉ được ẩn bớt. Nhập cả mã đơn và số điện thoại đặt hàng để xem đầy đủ.</p>}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
