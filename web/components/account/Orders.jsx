'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/ui/api'
import { ORDER_STATUS, PAYMENT_STATUS } from '@/ui/constants/orderStatus'
import { SHIPPING_STATUS } from '@/ui/constants/shippingStatus'
import { Notice, Field, input, btnPrimary, btnGhost, money, when, fullAddress } from './ui'

// Màu nhãn trạng thái dùng Tailwind (CSS cũ `status-*` nằm trong ui/, không áp dụng cho vùng tw-reset).
const TONE = {
  'status-pending': 'bg-amber-50 text-amber-800',
  'status-processing': 'bg-blue-50 text-blue-800',
  'status-ready': 'bg-indigo-50 text-indigo-800',
  'status-shipping': 'bg-sky-50 text-sky-800',
  'status-delivered': 'bg-green-50 text-green-800',
  'status-cancelled': 'bg-red-50 text-red-700',
  'status-returned': 'bg-stone-100 text-stone-700',
}
function Badge({ def, fallback }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[def?.cls] || 'bg-stone-100 text-stone-700'}`}>
      {def?.label || fallback}
    </span>
  )
}

export function OrderList({ onOpen }) {
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState('')
  const [claim, setClaim] = useState({ open: false, orderNumber: '', phone: '', busy: false, error: '' })

  const load = useCallback(() => {
    api.get('/account/orders').then(setOrders).catch((e) => setError(e.message))
  }, [])
  useEffect(load, [load])

  async function submitClaim(e) {
    e.preventDefault()
    setClaim((c) => ({ ...c, busy: true, error: '' }))
    try {
      await api.post('/account/orders/claim', { orderNumber: claim.orderNumber.trim(), phone: claim.phone.trim() })
      setClaim({ open: false, orderNumber: '', phone: '', busy: false, error: '' })
      setOrders(null)
      load()
    } catch (err) {
      setClaim((c) => ({ ...c, busy: false, error: err.message }))
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Đơn hàng của tôi</h2>
        <button className={btnGhost} onClick={() => setClaim((c) => ({ ...c, open: !c.open }))}>
          Liên kết đơn đã đặt trước đó
        </button>
      </div>

      {claim.open && (
        <form onSubmit={submitClaim} className="mt-4 space-y-3 rounded-xl border border-line bg-white p-4">
          <p className="text-sm text-muted">Nhập mã đơn và số điện thoại đã dùng khi đặt hàng (lúc chưa đăng nhập).</p>
          <Notice>{claim.error}</Notice>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Mã đơn hàng">
              <input className={input} value={claim.orderNumber} maxLength={30} required placeholder="ORD-12345"
                onChange={(e) => setClaim((c) => ({ ...c, orderNumber: e.target.value }))} />
            </Field>
            <Field label="Số điện thoại đặt hàng">
              <input className={input} value={claim.phone} maxLength={20} required inputMode="tel"
                onChange={(e) => setClaim((c) => ({ ...c, phone: e.target.value }))} />
            </Field>
          </div>
          <button className={btnPrimary} disabled={claim.busy}>{claim.busy ? 'Đang liên kết…' : 'Liên kết đơn'}</button>
        </form>
      )}

      <div className="mt-5 space-y-3">
        <Notice>{error}</Notice>
        {!orders && !error && <p className="text-sm text-muted">Đang tải…</p>}
        {orders?.length === 0 && (
          <div className="rounded-xl border border-line bg-white p-8 text-center">
            <p className="text-muted">Bạn chưa có đơn hàng nào.</p>
            <Link href="/products" className={`${btnPrimary} mt-4 inline-block`}>Mua sắm ngay</Link>
          </div>
        )}
        {orders?.map((o) => (
          <button key={o.orderNumber} onClick={() => onOpen(o.orderNumber)}
            className="block w-full rounded-xl border border-line bg-white p-4 text-left hover:border-accent">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">{o.orderNumber}</span>
              <span className="flex gap-2">
                <Badge def={ORDER_STATUS[o.status]} fallback={o.status} />
                <Badge def={PAYMENT_STATUS[o.paymentStatus]} fallback={o.paymentStatus} />
              </span>
            </div>
            <p className="mt-2 line-clamp-1 text-sm text-muted">
              {o.items.map((i) => `${i.name}${i.variant ? ` (${i.variant})` : ''} ×${i.quantity}`).join(', ')}
            </p>
            <p className="mt-2 flex justify-between text-sm">
              <span className="text-muted">{when(o.createdAt)}</span>
              <strong className="text-accent">{money(o.total)}</strong>
            </p>
          </button>
        ))}
      </div>
    </section>
  )
}

export function OrderDetail({ orderNumber, onBack }) {
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    setOrder(null)
    api.get(`/account/orders/${encodeURIComponent(orderNumber)}`).then(setOrder).catch((e) => setError(e.message))
  }, [orderNumber])

  return (
    <section>
      <button className={btnGhost} onClick={onBack}>← Tất cả đơn hàng</button>
      <div className="mt-4"><Notice>{error}</Notice></div>
      {!order && !error && <p className="mt-4 text-sm text-muted">Đang tải…</p>}
      {order && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold">Đơn {order.orderNumber}</h2>
            <span className="flex gap-2">
              <Badge def={ORDER_STATUS[order.status]} fallback={order.status} />
              <Badge def={PAYMENT_STATUS[order.paymentStatus]} fallback={order.paymentStatus} />
            </span>
          </div>
          <p className="text-sm text-muted">Đặt lúc {when(order.createdAt)}</p>

          <ul className="divide-y divide-line rounded-xl border border-line bg-white">
            {order.items.map((i, idx) => (
              <li key={idx} className="flex items-center gap-3 p-3">
                {i.image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={i.image} alt="" className="h-14 w-14 rounded-lg object-cover" />}
                <div className="min-w-0 flex-1">
                  {i.productId ? <Link href={`/products/${i.productId}`} className="font-medium hover:text-accent">{i.name}</Link> : <span className="font-medium">{i.name}</span>}
                  <p className="text-sm text-muted">{i.variant ? `${i.variant} · ` : ''}{money(i.unitPrice)} × {i.quantity}</p>
                </div>
                <strong className="text-sm">{money(i.lineTotal)}</strong>
              </li>
            ))}
          </ul>

          <dl className="grid gap-1 rounded-xl border border-line bg-white p-4 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Tạm tính</dt><dd>{money(order.subtotal)}</dd></div>
            {order.discount > 0 && <div className="flex justify-between"><dt className="text-muted">Giảm giá</dt><dd>-{money(order.discount)}</dd></div>}
            <div className="flex justify-between"><dt className="text-muted">Phí vận chuyển</dt><dd>{money(order.shippingFee)}</dd></div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-bold"><dt>Tổng cộng</dt><dd className="text-accent">{money(order.total)}</dd></div>
          </dl>

          <div className="rounded-xl border border-line bg-white p-4 text-sm">
            <h3 className="font-semibold">Giao đến</h3>
            <p className="mt-1">{order.recipientName}</p>
            <p className="text-muted">{fullAddress(order)}</p>
          </div>

          {order.shipment && (
            <div className="rounded-xl border border-line bg-white p-4 text-sm">
              <h3 className="font-semibold">Vận chuyển</h3>
              <p className="mt-1 text-muted">
                {order.shipment.carrier || 'Đơn vị vận chuyển'}
                {order.shipment.trackingId ? ` · Mã vận đơn ${order.shipment.trackingId}` : ''}
                {' · '}{SHIPPING_STATUS[order.shipment.status]?.label || order.shipment.status}
              </p>
              <ol className="mt-3 space-y-2 border-l-2 border-line pl-4">
                {[...order.shipment.events].reverse().map((e, i) => (
                  <li key={i}>
                    <p className="font-medium">{SHIPPING_STATUS[e.status]?.label || e.status}</p>
                    <p className="text-xs text-muted">{when(e.createdAt)}{e.location ? ` · ${e.location}` : ''}{e.note ? ` · ${e.note}` : ''}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="rounded-xl border border-line bg-white p-4 text-sm">
            <h3 className="font-semibold">Tiến trình đơn hàng</h3>
            <ol className="mt-3 space-y-2 border-l-2 border-line pl-4">
              {[...order.statusEvents].reverse().map((e, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="font-medium">{ORDER_STATUS[e.status]?.label || e.status}</span>
                  <span className="text-xs text-muted">{when(e.createdAt)}</span>
                </li>
              ))}
            </ol>
          </div>

          {order.paymentMethod === 'PAYOS' && order.paymentStatus === 'AWAITING_PAYMENT' && !['CANCELLED', 'RETURNED'].includes(order.status) && (
            <Link href={`/track-order?orderNumber=${encodeURIComponent(order.orderNumber)}`} className={`${btnPrimary} inline-block`}>
              Thanh toán đơn hàng
            </Link>
          )}
        </div>
      )}
    </section>
  )
}
