'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from '@/lib/router'
import AdminLayout from '../../components/dashboard/AdminLayout'
import StatusTimeline from '../../components/dashboard/StatusTimeline'
import ConfirmModal from '../../components/dashboard/ConfirmModal'
import CreateShipmentModal from '../../components/dashboard/orders/CreateShipmentModal'
import { api } from '../../api'
import {
  ORDER_STATUS,
  PAYMENT_STATUS,
  ORDER_TIMELINE_STEPS,
  orderStatusLabel,
  paymentStatusLabel,
} from '../../constants/orderStatus'
import { shippingStatusLabel, SHIPPING_STATUS } from '../../constants/shippingStatus'
import { formatCurrency, formatDateTime } from '../../utils/format'

const TIMELINE_LABELS = {
  PENDING_CONFIRMATION: 'Đặt hàng',
  CONFIRMED: 'Đã xác nhận',
  PROCESSING: 'Đang xử lý',
  AWAITING_SHIPMENT: 'Đã đóng gói / chờ bàn giao vận chuyển',
  SHIPPING: 'Đang giao',
  DELIVERED: 'Đã giao',
}

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null) // 'cancel' | 'confirm' | 'refund' | 'create-shipment'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get(`/orders/${id}`)
      setOrder(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function handleConfirmOrder() {
    await api.post(`/orders/${id}/confirm`, {})
    await load()
  }

  async function handleCancelOrder(note) {
    await api.post(`/orders/${id}/cancel`, { note })
    setModal(null)
    await load()
  }

  async function handleRefund(note) {
    await api.post(`/orders/${id}/refund`, { note })
    setModal(null)
    await load()
  }

  function handlePrintInvoice() {
    window.print()
  }

  if (loading) {
    return (
      <AdminLayout activeNav="orders" pageTitle="Đơn hàng">
        <div className="dash-card" style={{ textAlign: 'center', padding: '40px' }}>Đang tải...</div>
      </AdminLayout>
    )
  }

  if (error || !order) {
    return (
      <AdminLayout activeNav="orders" pageTitle="Lỗi">
        <div className="dash-card" style={{ textAlign: 'center', padding: '40px' }}>
          <p>{error || 'Không tìm thấy đơn hàng.'}</p>
          <button className="dash-btn" onClick={() => navigate('/dashboard/orders')}>Quay lại danh sách</button>
        </div>
      </AdminLayout>
    )
  }

  const canConfirm = order.status === 'PENDING_CONFIRMATION'
  const canCancel = !['CANCELLED', 'DELIVERED', 'RETURNED'].includes(order.status)
  const canRefund = order.paymentStatus === 'PAID'
  const canCreateShipment = !order.shipment && ['PROCESSING', 'AWAITING_SHIPMENT'].includes(order.status)
  const isCancelledOrReturned = ['CANCELLED', 'RETURNED'].includes(order.status)

  const timelineSteps = ORDER_TIMELINE_STEPS.map((key) => ({ key, label: TIMELINE_LABELS[key] }))
  const timelineEvents = order.statusEvents.filter((e) => ORDER_TIMELINE_STEPS.includes(e.status))

  return (
    <AdminLayout activeNav="orders" pageTitle={order.orderNumber}>
      <a className="detail-back-link" href="#" onClick={(e) => { e.preventDefault(); navigate('/dashboard/orders') }}>
        ← Quay lại danh sách đơn hàng
      </a>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--dash-heading)' }}>{order.orderNumber}</h2>
          <span className={`order-status-badge ${ORDER_STATUS[order.status]?.cls || ''}`}>{orderStatusLabel(order.status)}</span>
          <span className={`order-status-badge ${PAYMENT_STATUS[order.paymentStatus]?.cls || ''}`}>{paymentStatusLabel(order.paymentStatus)}</span>
          <span style={{ fontSize: '12px', color: 'var(--dash-muted)' }}>Đặt lúc {formatDateTime(order.createdAt)}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {canConfirm && <button className="dash-btn" onClick={handleConfirmOrder}>Xác nhận đơn</button>}
          {canCreateShipment && <button className="dash-btn" onClick={() => setModal('create-shipment')}>Tạo vận đơn</button>}
          {order.shipment && (
            <button className="dash-btn dash-btn-ghost" onClick={() => navigate(`/dashboard/shipping/${order.shipment.id}`)}>
              Xem vận đơn
            </button>
          )}
          <button className="dash-btn dash-btn-ghost" onClick={handlePrintInvoice}>In hóa đơn</button>
          {canRefund && <button className="dash-btn dash-btn-ghost" onClick={() => setModal('refund')}>Hoàn tiền</button>}
          {canCancel && <button className="dash-btn dash-btn-ghost" onClick={() => setModal('cancel')}>Hủy đơn</button>}
        </div>
      </div>

      {!isCancelledOrReturned && (
        <div className="dash-card" style={{ marginBottom: '24px' }}>
          <h3 className="form-card-title">Tiến trình đơn hàng</h3>
          <StatusTimeline steps={timelineSteps} events={timelineEvents} />
        </div>
      )}

      {isCancelledOrReturned && (
        <div className="dash-card" style={{ marginBottom: '24px' }}>
          <h3 className="form-card-title">{order.status === 'CANCELLED' ? 'Đơn hàng đã hủy' : 'Đơn hàng đã trả lại'}</h3>
          <div style={{ fontSize: '13px', lineHeight: '1.8' }}>
            {order.statusEvents.slice().reverse().slice(0, 1).map((e) => (
              <div key={e.id}>
                <strong>{formatDateTime(e.createdAt)}:</strong> {e.note || orderStatusLabel(e.status)}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div className="dash-card">
          <h3 className="form-card-title">Thông tin khách hàng</h3>
          <div style={{ fontSize: '13px', lineHeight: '1.9' }}>
            <div><strong>Tên:</strong> {order.customer.name}</div>
            <div><strong>Số điện thoại:</strong> {order.customer.phone}</div>
            <div><strong>Email:</strong> {order.customer.email || '—'}</div>
            <div><strong>Số đơn hàng trước đó:</strong> {order.customer.previousOrderCount}</div>
            <div><strong>Tổng chi tiêu:</strong> {formatCurrency(order.customer.totalSpent)}</div>
          </div>
        </div>

        <div className="dash-card">
          <h3 className="form-card-title">Địa chỉ giao hàng</h3>
          <div style={{ fontSize: '13px', lineHeight: '1.9' }}>
            <div><strong>Người nhận:</strong> {order.recipientName}</div>
            <div><strong>Số điện thoại:</strong> {order.recipientPhone}</div>
            <div><strong>Địa chỉ:</strong> {order.addressLine}</div>
            {order.ward && <div><strong>Phường/Xã:</strong> {order.ward}</div>}
            {order.district && <div><strong>Quận/Huyện:</strong> {order.district}</div>}
            <div><strong>Tỉnh/Thành phố:</strong> {order.province}</div>
          </div>
        </div>
      </div>

      <div className="dash-card dash-card-wide" style={{ marginBottom: '24px' }}>
        <h3 className="form-card-title">Thông tin sản phẩm</h3>
        <table className="dash-table">
          <thead>
            <tr>
              <th style={{ width: '48px' }}>Hình</th>
              <th>Sản phẩm</th>
              <th>SKU</th>
              <th>Variant</th>
              <th>Số lượng</th>
              <th>Đơn giá</th>
              <th>Giảm giá</th>
              <th>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it) => (
              <tr key={it.id}>
                <td>
                  {it.image ? (
                    <img src={it.image} alt={it.name} style={{ width: '36px', height: '36px', objectFit: 'cover' }} />
                  ) : '—'}
                </td>
                <td>{it.name}</td>
                <td>{it.sku || '—'}</td>
                <td>{it.variant || '—'}</td>
                <td>{it.quantity}</td>
                <td>{formatCurrency(it.unitPrice)}</td>
                <td>{it.discount ? formatCurrency(it.discount) : '—'}</td>
                <td>{formatCurrency(it.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div className="dash-card">
          <h3 className="form-card-title">Thông tin thanh toán</h3>
          <div style={{ fontSize: '13px', lineHeight: '1.9' }}>
            <div><strong>Tạm tính:</strong> {formatCurrency(order.subtotal)}</div>
            <div><strong>Giảm giá:</strong> {formatCurrency(order.discount)}</div>
            <div><strong>Phí vận chuyển:</strong> {formatCurrency(order.shippingFee)}</div>
            <div><strong>Thuế:</strong> {formatCurrency(order.tax)}</div>
            <div style={{ fontWeight: 700, color: 'var(--dash-heading)' }}><strong>Tổng cộng:</strong> {formatCurrency(order.total)}</div>
            <div><strong>Phương thức:</strong> {order.paymentMethod}</div>
            <div><strong>Trạng thái TT:</strong> {paymentStatusLabel(order.paymentStatus)}</div>
            <div><strong>Mã giao dịch:</strong> {order.transactionId || '—'}</div>
          </div>
        </div>

        <div className="dash-card">
          <h3 className="form-card-title">Vận chuyển</h3>
          {order.shipment ? (
            <div style={{ fontSize: '13px', lineHeight: '1.9' }}>
              <div><strong>Đơn vị:</strong> {order.shipment.carrier.name}</div>
              <div><strong>Mã vận đơn:</strong> {order.shipment.trackingId}</div>
              <div><strong>Phí vận chuyển:</strong> {formatCurrency(order.shipment.shippingFee)}</div>
              <div>
                <strong>Trạng thái:</strong>{' '}
                <span className={`order-status-badge ${SHIPPING_STATUS[order.shipment.status]?.cls || ''}`}>
                  {shippingStatusLabel(order.shipment.status)}
                </span>
              </div>
              <button className="dash-btn dash-btn-ghost" style={{ marginTop: '10px' }} onClick={() => navigate(`/dashboard/shipping/${order.shipment.id}`)}>
                Xem chi tiết vận đơn →
              </button>
            </div>
          ) : (
            <p className="dash-empty-state">Chưa tạo vận đơn cho đơn hàng này.</p>
          )}
        </div>
      </div>

      <div className="dash-card dash-card-wide">
        <h3 className="form-card-title">Nhật ký hoạt động</h3>
        {order.activityLogs.length === 0 ? (
          <p className="dash-empty-state">Chưa có hoạt động nào.</p>
        ) : (
          <div style={{ fontSize: '12px', lineHeight: '1.9' }}>
            {order.activityLogs.map((log) => (
              <div key={log.id}>
                <strong>{formatDateTime(log.createdAt)}</strong> — {log.action} bởi {log.actor}{log.note ? `: ${log.note}` : ''}
              </div>
            ))}
          </div>
        )}
      </div>

      {modal === 'cancel' && (
        <ConfirmModal
          title="Hủy đơn hàng"
          message={`Xác nhận hủy đơn ${order.orderNumber}? Hành động này không thể hoàn tác.`}
          requireNote
          confirmLabel="Hủy đơn"
          onConfirm={handleCancelOrder}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'refund' && (
        <ConfirmModal
          title="Hoàn tiền"
          message={`Xác nhận hoàn tiền cho đơn ${order.orderNumber}?`}
          requireNote
          confirmLabel="Hoàn tiền"
          onConfirm={handleRefund}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'create-shipment' && (
        <CreateShipmentModal
          order={order}
          onClose={() => setModal(null)}
          onCreated={(shipment) => {
            setModal(null)
            navigate(`/dashboard/shipping/${shipment.id}`)
          }}
        />
      )}
    </AdminLayout>
  )
}
