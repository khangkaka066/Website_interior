'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from '@/lib/router'
import AdminLayout from '../../components/dashboard/AdminLayout'
import StatusTimeline from '../../components/dashboard/StatusTimeline'
import ConfirmModal from '../../components/dashboard/ConfirmModal'
import DeliveryBadge from '../../components/DeliveryBadge'
import CreateShipmentModal from '../../components/dashboard/orders/CreateShipmentModal'
import GoshipShipmentModal from '../../components/dashboard/orders/GoshipShipmentModal'
import PrintOrdersModal from '../../components/dashboard/orders/PrintOrdersModal'
import RefundPanel from '../../components/dashboard/orders/RefundPanel'
import { paymentMethodLabel } from '../../constants/paymentMethod'
import { PICKUP_LABEL } from '../../components/dashboard/orders/PickupMethod'
import { api } from '../../api'
import {
  ORDER_STATUS,
  PAYMENT_STATUS,
  ORDER_TIMELINE_STEPS,
  orderStatusLabel,
  paymentStatusLabel,
} from '../../constants/orderStatus'
import { shippingStatusLabel, SHIPPING_STATUS } from '../../constants/shippingStatus'
import { formatCurrency, formatDateTime, dueIn } from '../../utils/format'

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
  const [modal, setModal] = useState(null) // 'cancel' | 'confirm' | 'refund' | 'create-shipment' | 'goship-shipment' | 'print' | 'cancel-approve' | 'cancel-reject' | 'return-approve' | 'return-reject'
  const [actionError, setActionError] = useState('')
  const [preparing, setPreparing] = useState(false)
  const [goshipReady, setGoshipReady] = useState(false) // đã bật tạo vận đơn thật qua Goship ở Cài đặt

  useEffect(() => {
    api.get('/shipping/goship/config').then((c) => setGoshipReady(Boolean(c.ready))).catch(() => setGoshipReady(false))
  }, [])

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

  // "Chuẩn bị hàng" như Shopee: xác nhận + sang Đang xử lý, rồi chọn cách giao cho hãng và tạo vận đơn; xong thì mở luôn tem để in.
  async function handlePrepare() {
    setActionError('')
    setPreparing(true)
    try {
      await api.post(`/orders/${id}/prepare`, {})
      await load()
      setModal(goshipReady ? 'goship-shipment' : 'create-shipment')
    } catch (err) {
      setActionError(err.message)
    } finally {
      setPreparing(false)
    }
  }

  // Vận đơn vừa tạo: tải lại đơn rồi mở khung xem trước tem để in ngay.
  async function afterShipmentCreated() {
    setModal(null)
    await load()
    setModal('print')
  }

  async function handleCancelOrder(note) {
    await api.post(`/orders/${id}/cancel`, { note })
    setModal(null)
    await load()
  }

  // Duyệt / từ chối yêu cầu hủy hoặc trả hàng của khách.
  async function respond(path, note) {
    await api.post(`/orders/${id}/${path}`, { note })
    setModal(null)
    await load()
  }

  async function toggleReviewHidden(review) {
    await api.patch(`/orders/reviews/${review.id}`, { hidden: !review.hidden })
    await load()
  }

  async function handleRefund(note) {
    await api.post(`/orders/${id}/refund`, { note })
    setModal(null)
    await load()
  }

  // Xem trước phiếu ngay trên trang này rồi in.
  function handlePrintInvoice() {
    setModal('print')
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

  const canCancel = !['CANCELLED', 'DELIVERED', 'RETURNED'].includes(order.status)
  const canRefund = order.paymentStatus === 'PAID'
  const hasActiveShipment = !!order.shipment && order.shipment.status !== 'NOT_CREATED'
  const canPrepare = !hasActiveShipment && ['PENDING_CONFIRMATION', 'CONFIRMED', 'PROCESSING', 'AWAITING_SHIPMENT'].includes(order.status) && !order.cancelRequestedAt
  const isCancelledOrReturned = ['CANCELLED', 'RETURNED'].includes(order.status)

  const due = dueIn(order.handleDueAt)
  const cancelAsk = !!order.cancelRequestedAt
  const ret = order.returnRequest
  const timelineSteps = ORDER_TIMELINE_STEPS.map((key) => ({ key, label: TIMELINE_LABELS[key] }))
  const timelineEvents = order.statusEvents.filter((e) => ORDER_TIMELINE_STEPS.includes(e.status))

  return (
    <AdminLayout activeNav="orders" pageTitle={order.code || order.orderNumber}>
      <a className="detail-back-link" href="#" onClick={(e) => { e.preventDefault(); navigate('/dashboard/orders') }}>
        ← Quay lại danh sách đơn hàng
      </a>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--dash-heading)' }}>{order.code || order.orderNumber}</h2>
          {order.code && order.code !== order.orderNumber && (
            <span style={{ fontSize: '12px', color: 'var(--dash-muted)' }}>Mã đơn: {order.orderNumber}</span>
          )}
          <DeliveryBadge type={order.deliveryType} />
          <span className={`order-status-badge ${ORDER_STATUS[order.status]?.cls || ''}`}>{orderStatusLabel(order.status)}</span>
          <span className={`order-status-badge ${PAYMENT_STATUS[order.paymentStatus]?.cls || ''}`}>{paymentStatusLabel(order.paymentStatus)}</span>
          <span style={{ fontSize: '12px', color: 'var(--dash-muted)' }}>Đặt lúc {formatDateTime(order.createdAt)}</span>
          {due && <span style={{ fontSize: '12px', fontWeight: 600, color: due.overdue ? 'var(--dash-danger, #c0392b)' : due.soon ? '#b26a00' : 'var(--dash-muted)' }}>Hạn xử lý: {due.text}</span>}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {canPrepare && <button className="dash-btn" onClick={handlePrepare} disabled={preparing}>{preparing ? 'Đang chuẩn bị…' : 'Chuẩn bị hàng'}</button>}
          {order.shipment && (
            <button className="dash-btn dash-btn-ghost" onClick={() => navigate(`/dashboard/shipping/${order.shipment.id}`)}>
              Xem vận đơn
            </button>
          )}
          <button className="dash-btn dash-btn-ghost" onClick={handlePrintInvoice}>In đơn</button>
          {canRefund && <button className="dash-btn dash-btn-ghost" onClick={() => setModal('refund')}>Hoàn tiền</button>}
          {canCancel && <button className="dash-btn dash-btn-ghost" onClick={() => setModal('cancel')}>Hủy đơn</button>}
        </div>
      </div>

      {actionError && (
        <div className="dash-card" style={{ marginBottom: '16px', padding: '12px 16px', color: 'var(--dash-danger, #c0392b)', fontSize: '13px' }}>{actionError}</div>
      )}

      <RefundPanel order={order} onChanged={load} />

      {cancelAsk && (
        <div className="dash-card" style={{ marginBottom: '24px', borderLeft: '4px solid var(--dash-danger, #c0392b)' }}>
          <h3 className="form-card-title">Khách yêu cầu hủy đơn</h3>
          <p style={{ fontSize: '13px', margin: '0 0 12px' }}>Lý do: <strong>{order.cancelRequestReason || '—'}</strong>. Không phản hồi thì hệ thống tự đồng ý lúc {order.cancelAutoApproveAt ? formatDateTime(order.cancelAutoApproveAt) : '(đã tắt)'}. Đồng ý thì đơn chuyển sang Đã hủy và tồn kho được trả lại{order.paymentStatus === 'PAID' ? ' (đơn đã thanh toán, bạn cần bấm Hoàn tiền sau đó)' : ''}.{order.shipment && order.shipment.status !== 'NOT_CREATED' ? ' Đơn đã có vận đơn: hãy hủy vận đơn trước.' : ''}</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="dash-btn" onClick={() => setModal('cancel-approve')}>Đồng ý hủy</button>
            <button className="dash-btn dash-btn-ghost" onClick={() => setModal('cancel-reject')}>Từ chối</button>
          </div>
        </div>
      )}

      {!cancelAsk && order.cancelRejectedNote && (
        <div className="dash-card" style={{ marginBottom: '24px', fontSize: '13px' }}>
          Đã từ chối yêu cầu hủy của khách: <strong>{order.cancelRejectedNote}</strong>
        </div>
      )}

      {ret && (
        <div className="dash-card" style={{ marginBottom: '24px', borderLeft: ret.status === 'REQUESTED' ? '4px solid var(--dash-danger, #c0392b)' : undefined }}>
          <h3 className="form-card-title">Yêu cầu trả hàng — {ret.status === 'REQUESTED' ? 'đang chờ duyệt' : ret.status === 'APPROVED' ? 'đã đồng ý' : 'đã từ chối'}</h3>
          <div style={{ fontSize: '13px', lineHeight: '1.8' }}>
            <div>Gửi lúc {formatDateTime(ret.createdAt)}. Lý do: <strong>{ret.reason}</strong></div>
            {ret.note && <div>Ghi chú của khách: {ret.note}</div>}
            {ret.adminNote && <div>Phản hồi của shop: {ret.adminNote}</div>}
            {ret.status === 'APPROVED' && order.paymentStatus === 'PAID' && <div>Đơn đã thanh toán: bấm <strong>Hoàn tiền</strong> khi đã nhận lại hàng.</div>}
          </div>
          {ret.status === 'REQUESTED' && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button className="dash-btn" onClick={() => setModal('return-approve')}>Đồng ý trả hàng</button>
              <button className="dash-btn dash-btn-ghost" onClick={() => setModal('return-reject')}>Từ chối</button>
            </div>
          )}
        </div>
      )}

      {order.status === 'DELIVERED' && (
        <div className="dash-card" style={{ marginBottom: '24px', fontSize: '13px' }}>
          {order.receivedAt ? <>Khách đã xác nhận nhận hàng lúc {formatDateTime(order.receivedAt)}.</> : <>Khách chưa xác nhận đã nhận hàng (hệ thống tự xác nhận theo quy tắc trong Cài đặt).</>}
        </div>
      )}

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
                <td>
                  {it.name}
                  {it.review && (
                    <div style={{ fontSize: '12px', marginTop: '4px', opacity: it.review.hidden ? 0.5 : 1 }}>
                      {'★'.repeat(it.review.rating)}{'☆'.repeat(5 - it.review.rating)} {it.review.comment || ''}{' '}
                      <button type="button" className="dash-btn dash-btn-ghost" style={{ fontSize: '11px', padding: '1px 8px' }} onClick={() => toggleReviewHidden(it.review)}>
                        {it.review.hidden ? 'Hiện đánh giá' : 'Ẩn đánh giá'}
                      </button>
                    </div>
                  )}
                </td>
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
            <div><strong>Phương thức:</strong> {paymentMethodLabel(order.paymentMethod)}</div>
            <div><strong>Trạng thái TT:</strong> {paymentStatusLabel(order.paymentStatus)}</div>
            <div><strong>Mã giao dịch:</strong> {order.transactionId || '—'}</div>
          </div>
        </div>

        <div className="dash-card">
          <h3 className="form-card-title">Vận chuyển</h3>
          {order.shipment ? (
            <div style={{ fontSize: '13px', lineHeight: '1.9' }}>
              <div><strong>Đơn vị:</strong> {order.shipment.carrier.name}</div>
              <div><strong>Mã vận đơn (hãng):</strong> {order.shipment.carrierCode || <span style={{ color: 'var(--dash-muted)' }}>chưa có — nhập ở trang vận đơn</span>}</div>
              <div><strong>Mã nội bộ:</strong> {order.shipment.trackingId}</div>
              {order.shipment.pickupMethod && <div><strong>Giao cho hãng:</strong> {PICKUP_LABEL[order.shipment.pickupMethod]}</div>}
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
      {modal === 'cancel-approve' && (
        <ConfirmModal title="Đồng ý yêu cầu hủy" message={`Hủy đơn ${order.orderNumber} theo yêu cầu của khách?`} confirmLabel="Đồng ý hủy" onConfirm={(note) => respond('cancel-request/approve', note)} onClose={() => setModal(null)} />
      )}
      {modal === 'cancel-reject' && (
        <ConfirmModal title="Từ chối yêu cầu hủy" message="Khách sẽ thấy lý do này trên trang theo dõi đơn." requireNote confirmLabel="Từ chối" onConfirm={(note) => respond('cancel-request/reject', note)} onClose={() => setModal(null)} />
      )}
      {modal === 'return-approve' && (
        <ConfirmModal title="Đồng ý trả hàng" message={`Đơn ${order.orderNumber} chuyển sang Đã trả hàng và tồn kho được cộng lại. Hoàn tiền (nếu đã thanh toán) bạn bấm riêng.`} confirmLabel="Đồng ý trả hàng" onConfirm={(note) => respond('return/approve', note)} onClose={() => setModal(null)} />
      )}
      {modal === 'return-reject' && (
        <ConfirmModal title="Từ chối trả hàng" message="Khách sẽ thấy lý do này trên trang theo dõi đơn." requireNote confirmLabel="Từ chối" onConfirm={(note) => respond('return/reject', note)} onClose={() => setModal(null)} />
      )}
      {modal === 'print' && <PrintOrdersModal ids={[order.id]} onClose={() => setModal(null)} />}

      {modal === 'goship-shipment' && (
        <GoshipShipmentModal
          order={order}
          onClose={() => setModal(null)}
          onManual={() => setModal('create-shipment')}
          onCreated={afterShipmentCreated}
        />
      )}
      {modal === 'create-shipment' && (
        <CreateShipmentModal
          order={order}
          onClose={() => setModal(null)}
          onCreated={afterShipmentCreated}
        />
      )}
    </AdminLayout>
  )
}
