'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '../../../api'

function money(n) {
  return Number(n || 0).toLocaleString('vi-VN') + 'đ'
}

// Tạo vận đơn THẬT qua Goship: phát sinh cước. Hỏi cước ngay lúc mở (mã lựa chọn chỉ có hiệu lực ngắn), admin chọn hãng,
// tích xác nhận rồi mới bấm tạo. Máy chủ hỏi lại cước lần nữa và từ chối nếu giá/hãng đã đổi.
export default function GoshipShipmentModal({ order, onClose, onCreated, onManual }) {
  const [state, setState] = useState({ loading: true, options: [], error: '', code: '' })
  const [rateId, setRateId] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }))
    setError('')
    try {
      const data = await api.get(`/shipping/goship/orders/${order.id}/rates`)
      setState({ loading: false, options: data.options, weightGrams: data.weightGrams, cod: data.cod, error: '', code: '' })
      setRateId(data.options[0]?.id || '') // mặc định hãng rẻ nhất (danh sách đã xếp rẻ trước)
    } catch (err) {
      setState({ loading: false, options: [], error: err.message, code: err.data?.code || '' })
    }
  }, [order.id])

  useEffect(() => {
    load()
  }, [load])

  const picked = state.options.find((o) => o.id === rateId)

  async function handleCreate() {
    if (!picked || !confirmed) return
    setSubmitting(true)
    setError('')
    try {
      const shipment = await api.post(`/shipping/goship/orders/${order.id}/shipment`, { rateId: picked.id, confirm: true })
      onCreated(shipment)
    } catch (err) {
      setSubmitting(false)
      if (err.data?.code === 'RATE_CHANGED') {
        setConfirmed(false)
        await load() // cước vừa đổi: tải lại để chọn đúng, rồi mới hiện thông báo (tải lại sẽ xóa lỗi cũ)
      }
      setError(err.message)
    }
  }

  return (
    <div className="dash-modal-overlay" onClick={submitting ? undefined : onClose}>
      <div className="dash-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dash-modal-head">
          <h3>Tạo vận đơn qua Goship — {order.orderNumber}</h3>
          <button className="dash-modal-close" onClick={onClose} disabled={submitting}>✕</button>
        </div>

        <div className="dash-form-grid">
          <div className="dash-form-field full">
            <label>Người nhận</label>
            <input value={`${order.recipientName} — ${order.recipientPhone}`} disabled />
          </div>
          <div className="dash-form-field full">
            <label>Địa chỉ nhận</label>
            <input value={[order.addressLine, order.ward, order.district, order.province].filter(Boolean).join(', ')} disabled />
          </div>
        </div>

        <h4 style={{ margin: '16px 0 8px', fontSize: '13px' }}>Chọn đơn vị vận chuyển</h4>
        {state.loading ? (
          <p style={{ fontSize: '13px', color: 'var(--dash-muted)' }}>Đang lấy cước từ Goship…</p>
        ) : state.error ? (
          <div style={{ fontSize: '13px', color: 'var(--dash-danger)' }}>
            <p style={{ marginBottom: '8px' }}>{state.error}</p>
            <button className="dash-btn dash-btn-ghost" onClick={load}>Thử lại</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {state.options.map((o) => (
              <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: `1px solid ${rateId === o.id ? 'var(--dash-accent, #b5602f)' : 'var(--dash-border)'}`, cursor: 'pointer' }}>
                <input type="radio" name="goship-rate" checked={rateId === o.id} onChange={() => setRateId(o.id)} />
                <span style={{ flex: 1 }}>
                  <strong>{o.carrier}{o.service ? ` – ${o.service}` : ''}</strong>
                  {o.expected && <small style={{ display: 'block', color: 'var(--dash-muted)' }}>{o.expected}</small>}
                </span>
                <strong>{money(o.originalFee ?? o.fee)}</strong>
              </label>
            ))}
            <p style={{ fontSize: '12px', color: 'var(--dash-muted)', margin: 0 }}>
              Cân nặng tính cước {state.weightGrams}g. Thu hộ COD: {money(state.cod)}. Cước hiển thị là cước shop trả cho Goship, khách đã trả phí vận chuyển trong tổng đơn.
            </p>
          </div>
        )}

        {picked && (
          <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginTop: '16px', padding: '10px 12px', background: 'var(--dash-warn-bg, #fff4e5)', fontSize: '13px', cursor: 'pointer' }}>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} style={{ marginTop: '3px' }} />
            <span>
              Tôi hiểu đây là <strong>vận đơn thật</strong>: Goship sẽ gửi yêu cầu lấy hàng tới <strong>{picked.carrier}</strong>, cước khoảng <strong>{money(picked.originalFee ?? picked.fee)}</strong> do shop trả.
              Chỉ hủy được khi hãng chưa lấy hàng.
            </span>
          </label>
        )}

        {error && <p style={{ color: 'var(--dash-danger)', fontSize: '13px', marginTop: '12px' }}>{error}</p>}

        <div className="dash-modal-actions">
          {onManual && (
            <button className="dash-btn dash-btn-ghost" onClick={onManual} disabled={submitting} style={{ marginRight: 'auto' }}>
              Tạo thủ công (không qua Goship)
            </button>
          )}
          <button className="dash-btn dash-btn-ghost" onClick={onClose} disabled={submitting}>Hủy</button>
          <button className="dash-btn" onClick={handleCreate} disabled={!picked || !confirmed || submitting}>
            {submitting ? 'Đang tạo vận đơn…' : 'Tạo vận đơn thật'}
          </button>
        </div>
      </div>
    </div>
  )
}
