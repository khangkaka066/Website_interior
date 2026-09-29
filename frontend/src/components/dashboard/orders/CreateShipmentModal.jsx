import { useState, useEffect } from 'react'
import { api } from '../../../api'
import { formatCurrency } from '../../../utils/format'

export default function CreateShipmentModal({ order, onClose, onCreated }) {
  const [carriers, setCarriers] = useState([])
  const [form, setForm] = useState({
    carrierId: '',
    senderName: 'Kho Clevinum Bình Thạnh',
    weightGrams: 500,
    lengthCm: '',
    widthCm: '',
    heightCm: '',
    goodsType: 'Hàng tiêu dùng',
    shippingFee: order.shippingFee || 25000,
    codAmount: order.paymentMethod === 'COD' ? order.total : 0,
    note: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/shipping/carriers').then((list) => {
      const enabled = list.filter((c) => c.enabled)
      setCarriers(enabled)
      if (enabled.length > 0) setForm((f) => ({ ...f, carrierId: enabled[0].id }))
    })
  }, [])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit() {
    if (!form.carrierId || !form.senderName || !form.weightGrams || !form.shippingFee) {
      setError('Vui lòng nhập đầy đủ thông tin bắt buộc.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const shipment = await api.post('/shipping', {
        orderId: order.id,
        carrierId: form.carrierId,
        senderName: form.senderName,
        weightGrams: Number(form.weightGrams),
        lengthCm: form.lengthCm ? Number(form.lengthCm) : null,
        widthCm: form.widthCm ? Number(form.widthCm) : null,
        heightCm: form.heightCm ? Number(form.heightCm) : null,
        goodsType: form.goodsType,
        shippingFee: Number(form.shippingFee),
        codAmount: Number(form.codAmount) || 0,
        note: form.note,
      })
      onCreated(shipment)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dash-modal-head">
          <h3>Tạo vận đơn — {order.orderNumber}</h3>
          <button className="dash-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="dash-form-grid">
          <div className="dash-form-field full">
            <label>Người nhận</label>
            <input value={`${order.recipientName} — ${order.recipientPhone}`} disabled />
          </div>
          <div className="dash-form-field full">
            <label>Địa chỉ nhận</label>
            <input
              value={[order.addressLine, order.ward, order.district, order.province].filter(Boolean).join(', ')}
              disabled
            />
          </div>
          <div className="dash-form-field">
            <label>Người gửi *</label>
            <input value={form.senderName} onChange={(e) => update('senderName', e.target.value)} />
          </div>
          <div className="dash-form-field">
            <label>Đơn vị vận chuyển *</label>
            <select value={form.carrierId} onChange={(e) => update('carrierId', e.target.value)}>
              {carriers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="dash-form-field">
            <label>Khối lượng (gram) *</label>
            <input type="number" value={form.weightGrams} onChange={(e) => update('weightGrams', e.target.value)} />
          </div>
          <div className="dash-form-field">
            <label>Loại hàng</label>
            <input value={form.goodsType} onChange={(e) => update('goodsType', e.target.value)} />
          </div>
          <div className="dash-form-field">
            <label>Dài (cm)</label>
            <input type="number" value={form.lengthCm} onChange={(e) => update('lengthCm', e.target.value)} />
          </div>
          <div className="dash-form-field">
            <label>Rộng (cm)</label>
            <input type="number" value={form.widthCm} onChange={(e) => update('widthCm', e.target.value)} />
          </div>
          <div className="dash-form-field">
            <label>Cao (cm)</label>
            <input type="number" value={form.heightCm} onChange={(e) => update('heightCm', e.target.value)} />
          </div>
          <div className="dash-form-field">
            <label>Phí vận chuyển *</label>
            <input type="number" value={form.shippingFee} onChange={(e) => update('shippingFee', e.target.value)} />
          </div>
          <div className="dash-form-field">
            <label>COD ({formatCurrency(order.total)} tổng đơn)</label>
            <input type="number" value={form.codAmount} onChange={(e) => update('codAmount', e.target.value)} />
          </div>
          <div className="dash-form-field full">
            <label>Ghi chú giao hàng</label>
            <textarea value={form.note} onChange={(e) => update('note', e.target.value)} />
          </div>
        </div>

        {error && <p style={{ color: 'var(--dash-danger)', fontSize: '12px', marginTop: '10px' }}>{error}</p>}

        <div className="dash-modal-actions">
          <button className="dash-btn dash-btn-ghost" onClick={onClose} disabled={submitting}>
            Hủy
          </button>
          <button className="dash-btn" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Đang tạo...' : 'Tạo vận đơn'}
          </button>
        </div>
      </div>
    </div>
  )
}
