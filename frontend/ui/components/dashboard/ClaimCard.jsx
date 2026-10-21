'use client'

import { useState } from 'react'
import { api } from '../../api'
import { formatCurrency, formatDateTime } from '../../utils/format'
import { INACTIVE_SHIPMENT } from '../../constants/shippingStatus'

const STATUS = { REQUESTED: 'Đã gửi, chờ Goship trả lời', COMPENSATED: 'Goship đã đền bù', REJECTED: 'Goship từ chối' }

// Đòi Goship đền bù khi hàng mất / hỏng (thường sau khi duyệt trả hàng "lỗi vận chuyển"). Đền bù thành công được ghi vào "Thu nhập khác".
export default function ClaimCard({ shipment, onChanged }) {
  const [form, setForm] = useState({ amount: '', note: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (INACTIVE_SHIPMENT.includes(shipment.status)) return null

  async function send(path, body) {
    setBusy(true)
    setError('')
    try {
      await api.post(`/shipping/${shipment.id}/${path}`, body)
      setForm({ amount: '', note: '' })
      await onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const st = shipment.claimStatus
  const canOpen = !st || st === 'REJECTED'
  const field = { fontSize: '13px', padding: '6px 10px' }

  return (
    <div className="dash-card" style={{ marginBottom: '24px' }}>
      <h3 className="form-card-title">Đền bù từ Goship (hàng mất / hỏng)</h3>
      <div style={{ fontSize: '13px', lineHeight: 1.9 }}>
        {st ? (
          <>
            <div><strong>Trạng thái:</strong> {STATUS[st]}{shipment.claimAt ? ` (gửi lúc ${formatDateTime(shipment.claimAt)})` : ''}</div>
            <div><strong>Số tiền đòi:</strong> {formatCurrency(shipment.claimAmount || 0)}{st === 'COMPENSATED' ? ` · đã nhận ${formatCurrency(shipment.claimCompensation || 0)} (thu nhập khác)` : ''}</div>
            {shipment.claimNote && <div><strong>Ghi chú:</strong> {shipment.claimNote}</div>}
          </>
        ) : (
          <div style={{ color: 'var(--dash-muted)' }}>Chưa có yêu cầu đền bù. Chỉ gửi khi hàng thất lạc hoặc hư hỏng do vận chuyển.</div>
        )}
      </div>

      {st === 'REQUESTED' && (
        <form style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }} onSubmit={(e) => { e.preventDefault(); send('claim/resolve', { status: 'COMPENSATED', amount: Number(form.amount), note: form.note }) }}>
          <input style={field} inputMode="numeric" placeholder="Số tiền Goship đã đền bù" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/\D/g, '') })} aria-label="Số tiền Goship đã đền bù" />
          <input style={{ ...field, flex: '1 1 180px' }} placeholder="Ghi chú (không bắt buộc)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={300} aria-label="Ghi chú" />
          <button className="dash-btn" disabled={busy || !form.amount}>Ghi nhận đã được đền bù</button>
          <button type="button" className="dash-btn dash-btn-ghost" disabled={busy} onClick={() => send('claim/resolve', { status: 'REJECTED', note: form.note })}>Goship từ chối</button>
        </form>
      )}

      {canOpen && (
        <form style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }} onSubmit={(e) => { e.preventDefault(); send('claim', { amount: Number(form.amount), note: form.note }) }}>
          <input style={field} inputMode="numeric" placeholder="Số tiền đòi đền bù" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/\D/g, '') })} aria-label="Số tiền đòi đền bù" />
          <input style={{ ...field, flex: '1 1 220px' }} placeholder="Lý do (mất hàng, vỡ hỏng...)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={300} aria-label="Lý do" />
          <button className="dash-btn" disabled={busy || !Number(form.amount) || !form.note.trim()}>{st === 'REJECTED' ? 'Gửi lại yêu cầu đền bù' : 'Gửi yêu cầu đền bù'}</button>
        </form>
      )}
      {error && <p className="oa-error" role="alert">{error}</p>}
    </div>
  )
}
