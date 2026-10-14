'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'
import { api } from '../../../api'
import { paymentStatusLabel } from '../../../constants/orderStatus'
import { formatCurrency, formatDateTime } from '../../../utils/format'
import '../../../styles/print.css'

const MAX_ORDERS = 50

// Mã vạch Code128 vẽ bằng SVG (in ra nét, không mờ). Mã không mã hóa được thì bỏ qua, phiếu vẫn in chữ.
function Barcode({ value, height = 44, width = 1.6, fontSize = 13 }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current || !value) return
    try {
      JsBarcode(ref.current, value, { format: 'CODE128', displayValue: false, height, width, margin: 0, fontSize })
    } catch {
      ref.current.replaceChildren()
    }
  }, [value, height, width, fontSize])
  return <svg ref={ref} className="print-barcode" aria-label={`Mã vạch ${value}`} />
}


// Mã QR (ảnh data URL) của mã vận đơn; lỗi thì bỏ qua, tem vẫn có mã vạch.
function Qr({ value }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(value, { margin: 0, width: 220, errorCorrectionLevel: 'M' })
      .then((u) => !cancelled && setSrc(u))
      .catch(() => !cancelled && setSrc(''))
    return () => {
      cancelled = true
    }
  }, [value])
  return src ? <img className="lbl-qr" src={src} alt={`QR ${value}`} /> : null
}

const MAX_LABEL_ITEMS = 8
const vnd = (n) => `${Math.round(Number(n) || 0).toLocaleString('vi-VN')} VND`

// Tem giao hàng khổ A6 (dán lên kiện hàng): mã vạch vận đơn, nơi gửi/nhận, mã phân loại, nội dung hàng, tiền thu hộ, chữ ký.
function LabelSheet({ order, shop, skipped, onToggle }) {
  const ship = order.shipment && order.shipment.status !== 'NOT_CREATED' ? order.shipment : null
  const addr = [order.addressLine, order.ward, order.district, order.province].filter(Boolean).join(', ')
  const code = ship?.carrierCode || order.orderNumber // có vận đơn thì quét mã hãng, chưa có thì quét mã đơn
  const collect = order.paymentMethod === 'COD' && order.paymentStatus !== 'PAID' ? Math.round(Number(order.total)) : 0
  const totalQty = order.items.reduce((n, it) => n + (Number(it.quantity) || 0), 0)
  const shown = order.items.slice(0, MAX_LABEL_ITEMS)
  const more = order.items.length - shown.length

  return (
    <section className={`print-sheet lbl-sheet${skipped ? ' print-skip' : ''}`}>
      <label className="print-pick">
        <input type="checkbox" checked={!skipped} onChange={onToggle} /> In tem này
      </label>

      <div className="lbl-top">
        <div className="lbl-brand">
          <div className="lbl-shop">{shop.name}</div>
          <div className="lbl-carrier">{ship?.carrier?.name || 'Giao hàng'}</div>
        </div>
        <div className="lbl-codes">
          <Barcode value={code} height={38} width={1.3} fontSize={11} />
          <div>Mã vận đơn: <b>{code}</b></div>
          <div>Mã đơn hàng: {order.orderNumber}</div>
        </div>
      </div>

      <div className="lbl-addr">
        <div className="lbl-from">
          <b>Từ:</b>
          <div>{shop.name}</div>
          {shop.address && <div>{shop.address}</div>}
          {shop.hotline && <div>SĐT: {shop.hotline}</div>}
        </div>
        <div className="lbl-to">
          <b>Đến:</b>
          <div className="lbl-strong">{order.recipientName} · {order.recipientPhone}</div>
          <div>{addr}</div>
        </div>
      </div>

      <div className="lbl-sort">{ship?.sortingCode || order.code || order.orderNumber}</div>

      <div className="lbl-body">
        <div className="lbl-items">
          <b>Nội dung hàng (Tổng SL sản phẩm: {totalQty})</b>
          {shown.map((it, i) => (
            <div key={it.id || i}>
              {i + 1}. {it.name}{it.variant ? ` - ${it.variant}` : ''}, SL: {it.quantity}
            </div>
          ))}
          {more > 0 && <div>… và {more} sản phẩm khác</div>}
        </div>
        <div className="lbl-side">
          <Qr value={code} />
          <div className="lbl-date-label">Ngày đặt hàng:</div>
          <div className="lbl-date">{formatDateTime(order.createdAt)}</div>
        </div>
      </div>

      {ship?.weightGrams ? <div className="lbl-weight">Khối lượng tối đa: {ship.weightGrams}g</div> : null}

      <div className="lbl-bottom">
        <div className="lbl-cod">
          <div>Tiền thu Người nhận:</div>
          <div className="lbl-cod-amount">{vnd(collect)}</div>
        </div>
        <div className="lbl-sign">
          <b>Chữ ký người nhận</b>
          <div>Xác nhận hàng nguyên vẹn, không móp/méo, bể/vỡ</div>
        </div>
      </div>

      {ship?.note && <div className="lbl-note"><b>Chỉ dẫn giao hàng:</b> {ship.note}</div>}
      <div className="lbl-foot">Cảm ơn quý khách đã mua hàng tại {shop.name}!{shop.hotline ? ` · Hotline: ${shop.hotline}` : ''}</div>
    </section>
  )
}

// Phiếu A4 cho khách/kho: chỉ có thông tin giao hàng và thanh toán, không có ghi chú nội bộ hay nhật ký hoạt động.
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
        <div className="print-barcode-text">{barcodeValue}</div>
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
  const [format, setFormat] = useState(() => {
    try {
      return localStorage.getItem('clevinum_print_format') === 'a4' ? 'a4' : 'label'
    } catch {
      return 'label'
    }
  })

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

  function pickFormat(f) {
    setFormat(f)
    try {
      localStorage.setItem('clevinum_print_format', f)
    } catch {
      // không lưu được lựa chọn khổ giấy: vẫn dùng trong lần này
    }
  }

  const toggle = (id) => setSkipped((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const count = orders ? orders.filter((o) => !skipped.has(o.id)).length : 0

  // Cổng (portal) gắn thẳng vào <body> để CSS in ẩn được toàn bộ giao diện admin, chỉ giữ lại phiếu.
  return createPortal(
    <div className="print-portal" onClick={onClose}>
      <div className="print-toolbar" onClick={(e) => e.stopPropagation()}>
        <button className="print-btn" onClick={() => window.print()} disabled={!count}>🖨 In {count} đơn</button>
        <button className="print-btn print-btn-ghost" onClick={onClose}>Đóng</button>
        <span className="print-seg">
          <button className={format === 'label' ? 'on' : ''} onClick={() => pickFormat('label')}>Tem giao hàng (A6)</button>
          <button className={format === 'a4' ? 'on' : ''} onClick={() => pickFormat('a4')}>Phiếu đơn (A4)</button>
        </span>
        <span className="print-hint">Bỏ tích ở từng phiếu để loại bớt đơn trước khi in.</span>
      </div>
      {/* Khổ giấy theo kiểu in đang chọn (chọn lại khổ trong hộp thoại in nếu máy in dùng khổ khác). */}
      <style>{format === 'label' ? '@media print { @page { size: A6; margin: 3mm } }' : '@media print { @page { size: A4; margin: 12mm } }'}</style>
      <div className={`print-page${format === 'label' ? ' print-page-label' : ''}`} onClick={(e) => e.stopPropagation()}>
        {error && <p className="print-error">{error}</p>}
        {!orders && !error && <p>Đang tải phiếu…</p>}
        {orders?.map((o) => {
          const Comp = format === 'label' ? LabelSheet : Sheet
          return <Comp key={o.id} order={o} shop={shop} skipped={skipped.has(o.id)} onToggle={() => toggle(o.id)} />
        })}
      </div>
    </div>,
    document.body,
  )
}
