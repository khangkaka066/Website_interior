import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/dashboard/AdminLayout'
import StatusTimeline from '../../components/dashboard/StatusTimeline'
import ConfirmModal from '../../components/dashboard/ConfirmModal'
import { api } from '../../api'
import { SHIPPING_STATUS, SHIPPING_TIMELINE_STEPS, SHIPPING_TRANSITIONS, shippingStatusLabel } from '../../constants/shippingStatus'
import { formatCurrency, formatDateTime } from '../../utils/format'

const TIMELINE_LABELS = {
  AWAITING_PICKUP: 'Chờ lấy hàng',
  PICKED_UP: 'Đã lấy hàng',
  IN_TRANSIT: 'Đang trung chuyển',
  OUT_FOR_DELIVERY: 'Đang giao',
  DELIVERED: 'Giao thành công',
}

export default function ShippingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [shipment, setShipment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null) // 'cancel' | 'update-status'
  const [nextStatus, setNextStatus] = useState('')
  const [location, setLocation] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get(`/shipping/${id}`)
      setShipment(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function handleUpdateStatus(note) {
    await api.patch(`/shipping/${id}/status`, { status: nextStatus, location, note })
    setModal(null)
    setNextStatus('')
    setLocation('')
    await load()
  }

  async function handleCancel(note) {
    await api.post(`/shipping/${id}/cancel`, { note })
    setModal(null)
    await load()
  }

  function handleCopyTracking() {
    navigator.clipboard?.writeText(shipment.trackingId)
  }

  if (loading) {
    return (
      <AdminLayout activeNav="shipping" pageTitle="Vận chuyển">
        <div className="dash-card" style={{ textAlign: 'center', padding: '40px' }}>Đang tải...</div>
      </AdminLayout>
    )
  }

  if (error || !shipment) {
    return (
      <AdminLayout activeNav="shipping" pageTitle="Lỗi">
        <div className="dash-card" style={{ textAlign: 'center', padding: '40px' }}>
          <p>{error || 'Không tìm thấy vận đơn.'}</p>
          <button className="dash-btn" onClick={() => navigate('/dashboard/shipping')}>Quay lại</button>
        </div>
      </AdminLayout>
    )
  }

  const nextOptions = SHIPPING_TRANSITIONS[shipment.status] || []
  const canCancel = !['DELIVERED', 'RETURNED'].includes(shipment.status)
  const timelineSteps = SHIPPING_TIMELINE_STEPS.map((key) => ({ key, label: TIMELINE_LABELS[key] }))
  const timelineEvents = timelineSteps
    .map((step) => {
      const match = shipment.trackingEvents.find((e) => shippingStatusLabel(step.key) === e.status || TIMELINE_LABELS[step.key] === e.status)
      return match ? { status: step.key, createdAt: match.createdAt, location: match.location, note: match.note } : null
    })
    .filter(Boolean)

  return (
    <AdminLayout activeNav="shipping" pageTitle={shipment.trackingId}>
      <a className="detail-back-link" href="#" onClick={(e) => { e.preventDefault(); navigate('/dashboard/shipping') }}>
        ← Quay lại danh sách vận đơn
      </a>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--dash-heading)' }}>{shipment.trackingId}</h2>
          <span className={`order-status-badge ${SHIPPING_STATUS[shipment.status]?.cls || ''}`}>{shippingStatusLabel(shipment.status)}</span>
          <button className="dash-btn dash-btn-ghost" onClick={handleCopyTracking} style={{ fontSize: '11px', padding: '4px 10px' }}>Copy mã</button>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {nextOptions.length > 0 && (
            <button className="dash-btn" onClick={() => { setNextStatus(nextOptions[0]); setModal('update-status') }}>
              Cập nhật trạng thái
            </button>
          )}
          <button className="dash-btn dash-btn-ghost" onClick={() => window.print()}>In shipping label</button>
          <button className="dash-btn dash-btn-ghost" onClick={() => navigate(`/dashboard/orders/${shipment.order.id}`)}>Xem đơn hàng</button>
          {canCancel && <button className="dash-btn dash-btn-ghost" onClick={() => setModal('cancel')}>Hủy vận đơn</button>}
        </div>
      </div>

      <div className="dash-card" style={{ marginBottom: '24px' }}>
        <h3 className="form-card-title">Hành trình vận chuyển</h3>
        <StatusTimeline steps={timelineSteps} events={timelineEvents} failed={shipment.status === 'FAILED'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div className="dash-card">
          <h3 className="form-card-title">Thông tin vận đơn</h3>
          <div style={{ fontSize: '13px', lineHeight: '1.9' }}>
            <div><strong>Order ID:</strong> {shipment.order.orderNumber}</div>
            <div><strong>Đơn vị vận chuyển:</strong> {shipment.carrier.name}</div>
            <div><strong>Người gửi:</strong> {shipment.senderName}</div>
            <div><strong>Khối lượng:</strong> {shipment.weightGrams}g</div>
            {shipment.lengthCm && <div><strong>Kích thước:</strong> {shipment.lengthCm}×{shipment.widthCm}×{shipment.heightCm} cm</div>}
            <div><strong>Loại hàng:</strong> {shipment.goodsType || '—'}</div>
            <div><strong>Phí vận chuyển:</strong> {formatCurrency(shipment.shippingFee)}</div>
            <div><strong>COD:</strong> {shipment.codAmount ? formatCurrency(shipment.codAmount) : '—'}</div>
          </div>
        </div>

        <div className="dash-card">
          <h3 className="form-card-title">Người nhận</h3>
          <div style={{ fontSize: '13px', lineHeight: '1.9' }}>
            <div><strong>Tên:</strong> {shipment.recipientName}</div>
            <div><strong>Số điện thoại:</strong> {shipment.recipientPhone}</div>
            <div><strong>Địa chỉ:</strong> {[shipment.addressLine, shipment.ward, shipment.district, shipment.province].filter(Boolean).join(', ')}</div>
          </div>
        </div>
      </div>

      <div className="dash-card dash-card-wide">
        <h3 className="form-card-title">Lịch sử cập nhật</h3>
        {shipment.trackingEvents.length === 0 ? (
          <p className="dash-empty-state">Chưa có cập nhật nào.</p>
        ) : (
          <div style={{ fontSize: '13px', lineHeight: '1.9' }}>
            {shipment.trackingEvents.slice().reverse().map((e) => (
              <div key={e.id} style={{ paddingBottom: '10px', borderBottom: '1px solid var(--dash-border)', marginBottom: '10px' }}>
                <strong>{formatDateTime(e.createdAt)}</strong> — {e.status}
                {e.location && <span> · {e.location}</span>}
                {e.note && <div style={{ color: 'var(--dash-muted)', fontSize: '12px' }}>{e.note}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {modal === 'cancel' && (
        <ConfirmModal
          title="Hủy vận đơn"
          message={`Xác nhận hủy vận đơn ${shipment.trackingId}?`}
          requireNote
          confirmLabel="Hủy vận đơn"
          onConfirm={handleCancel}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'update-status' && (
        <div className="dash-modal-overlay" onClick={() => setModal(null)}>
          <div className="dash-modal" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="dash-modal-head">
              <h3>Cập nhật trạng thái</h3>
              <button className="dash-modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="dash-form-field full" style={{ marginBottom: '10px' }}>
              <label>Trạng thái mới</label>
              <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
                {nextOptions.map((s) => (
                  <option key={s} value={s}>{shippingStatusLabel(s)}</option>
                ))}
              </select>
            </div>
            <div className="dash-form-field full">
              <label>Địa điểm</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="VD: Kho Bình Thạnh" />
            </div>
            <ConfirmInline onConfirm={handleUpdateStatus} onClose={() => setModal(null)} />
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

function ConfirmInline({ onConfirm, onClose }) {
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setSubmitting(true)
    setError('')
    try {
      await onConfirm(note)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="dash-form-field full" style={{ marginTop: '10px' }}>
        <label>Ghi chú (tùy chọn)</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {error && <p style={{ color: 'var(--dash-danger)', fontSize: '12px', marginTop: '8px' }}>{error}</p>}
      <div className="dash-modal-actions">
        <button className="dash-btn dash-btn-ghost" onClick={onClose} disabled={submitting}>Đóng</button>
        <button className="dash-btn" onClick={submit} disabled={submitting}>{submitting ? 'Đang lưu...' : 'Xác nhận'}</button>
      </div>
    </>
  )
}
