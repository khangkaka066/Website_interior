'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import JsBarcode from 'jsbarcode'
import { api } from '../../../api'
import { paymentStatusLabel } from '../../../constants/orderStatus'
import { formatCurrency, formatDateTime } from '../../../utils/format'
import '../../../styles/print.css'

const MAX_ORDERS = 50

// Mã vạch Code128 vẽ bằng SVG (in ra nét, không mờ). Mã không mã hóa được thì bỏ qua, phiếu vẫn in chữ.
function Barcode({ value }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current || !value) return
    try {
      JsBarcode(ref.current, value, { format: 'CODE128', displayValue: true, height: 44, width: 1.6, margin: 0, fontSize: 13 })
    } catch {
      ref.current.replaceChildren()
    }
  }, [value])
  return <svg ref={ref} className="print-barcode" aria-label={`Mã vạch ${value}`} />
}

// Phiếu in cho khách/kho: chỉ có thông tin giao hàng và thanh toán, không có ghi chú nội bộ hay nhật ký hoạt động.
function Sheet({ order, shop, skipped, onToggle }) {
  const addr = [order.addressLine, order.ward, order.district, order.province].filter(Boolean).join(', ')
  const ship = order.shipment && order.shipment.status !== 'NOT_CREATED' ? order.shipment : null
  const isCod = order.paymentMethod === 'COD'
  const paid = order.paymentStatus === 'PAID'
  const collect = isCod && !paid ? Math.round(Number(order.total)) : 0
  const discount = Number(order.discount) || 0
  const barcodeValue = ship?.carrierCode || order.orderNumber // có vận đơn thì quét mã hãng, chưa có thì quét mã đơn

  return (
    <section className={`print-sheet${skipped ? ' print-skip' : ''}`}>
      <label className="print-pick">
        <input type="checkbox" checked={!skipped} onChange={onToggle} /> In đơn này
      </label>
      <header className="print-head">
        <div>
          <div className="print-shop">{shop.name}</div>
          {shop.address && <div>{shop.address}</div>}
          {shop.hotline && <div>Hotline: {shop.hotline}</div>}
        </div>
        <div className="print-code-box">
          <div className="print-title">PHIẾU ĐƠN HÀNG</div>
          <div className="print-code">{order.code || order.orderNumber}</div>
          {order.code && order.code !== order.orderNumber && <div>Mã đơn: {order.orderNumber}</div>}
          <div>Ngày đặt: {formatDateTime(order.createdAt)}</div>
        </div>
      </header>

      <div className="print-barcode-row">
        <Barcode value={barcodeValue} />
      </div>

      <div className="print-cols">
        <div>
          <h4>Người nhận</h4>
          <div className="print-strong">{order.recipientName}</div>
          <div>{order.recipientPhone}</div>
          <div>{addr}</div>
        </div>
        <div>
          <h4>Vận chuyển</h4>
          {ship ? (
            <>
              <div>{ship.carrier?.name}</div>
              <div>Mã vận đơn: <span className="print-strong">{ship.carrierCode || '—'}</span></div>
            </>
          ) : (
            <div>Chưa có vận đơn</div>
          )}
          <div>Thanh toán: {order.paymentMethod} · {paymentStatusLabel(order.paymentStatus)}</div>
        </div>
      </div>

      <table className="print-table">
        <thead>
          <tr>
            <th style={{ width: '32px' }}>#</th>
            <th>Sản phẩm</th>
            <th style={{ width: '48px' }}>SL</th>
            <th style={{ width: '96px' }}>Đơn giá</th>
            <th style={{ width: '104px' }}>Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((it, i) => (
            <tr key={it.id || i}>
              <td>{i + 1}</td>
              <td>
                {it.name}
                {it.variant && <div className="print-muted">{it.variant}</div>}
              </td>
              <td>{it.quantity}</td>
              <td className="print-num">{formatCurrency(it.unitPrice)}</td>
              <td className="print-num">{formatCurrency(it.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="print-totals">
        <div><span>Tạm tính</span><span>{formatCurrency(order.subtotal)}</span></div>
        {discount > 0 && <div><span>Giảm giá</span><span>-{formatCurrency(discount)}</span></div>}
        <div><span>Phí vận chuyển</span><span>{formatCurrency(order.shippingFee)}</span></div>
        <div className="print-grand"><span>Tổng cộng</span><span>{formatCurrency(order.total)}</span></div>
        {collect > 0 ? (
          <div className="print-collect"><span>Thu hộ (COD)</span><span>{formatCurrency(collect)}</span></div>
        ) : (
          <div className="print-muted"><span>{paid ? 'Đã thanh toán' : 'Không thu tiền khi giao'}</span><span /></div>
        )}
      </div>

      <footer className="print-foot">Cảm ơn quý khách đã mua hàng tại {shop.name}!</footer>
    </section>
  )
}

// Khung xem trước phiếu ngay trên trang đơn hàng (không mở trang mới). Bấm "In" để in các đơn đang được chọn.
export default function PrintOrdersModal({ ids, onClose }) {
  const idList = [...new Set(ids)].slice(0, MAX_ORDERS)
  const idsKey = idList.join(',')

  const [orders, setOrders] = useState(null)
  const [shop, setShop] = useState({ name: '' })
  const [error, setError] = useState('')
  const [skipped, setSkipped] = useState(() => new Set())

  useEffect(() => {
    let cancelled = false
    Promise.all([
      Promise.all(idsKey.split(',').map((id) => api.get(`/orders/${encodeURIComponent(id)}`))),
      api.get('/shop/info').catch(() => ({})),
    ])
      .then(([list, info]) => {
        if (cancelled) return
        setShop({ name: info.name || '', address: info.address, hotline: info.hotline })
        setOrders(list)
      })
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [idsKey])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const toggle = (id) => setSkipped((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const count = orders ? orders.filter((o) => !skipped.has(o.id)).length : 0

  // Cổng (portal) gắn thẳng vào <body> để CSS in ẩn được toàn bộ giao diện admin, chỉ giữ lại phiếu.
  return createPortal(
    <div className="print-portal" onClick={onClose}>
      <div className="print-page" onClick={(e) => e.stopPropagation()}>
        <div className="print-toolbar">
          <button className="dash-btn" onClick={() => window.print()} disabled={!count}>In {count} đơn</button>
          <button className="dash-btn dash-btn-ghost" onClick={onClose}>Đóng</button>
          <span className="print-hint">Xem trước phiếu. Bỏ tích “In đơn này” để loại bớt đơn trước khi in.</span>
        </div>
        {error && <p className="print-error">{error}</p>}
        {!orders && !error && <p>Đang tải phiếu…</p>}
        {orders?.map((o) => <Sheet key={o.id} order={o} shop={shop} skipped={skipped.has(o.id)} onToggle={() => toggle(o.id)} />)}
      </div>
    </div>,
    document.body,
  )
}
