'use client'

import { useState } from 'react'

// Shared confirmation dialog for dangerous actions (cancel order, refund,
// cancel shipment...). When `requireNote` is set, a reason must be typed
// before the confirm button is enabled.
export default function ConfirmModal({ title, message, requireNote = false, confirmLabel = 'Xác nhận', onConfirm, onClose }) {
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    if (requireNote && !note.trim()) {
      setError('Vui lòng nhập lý do.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await onConfirm(note.trim())
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div className="dash-modal-head">
          <h3>{title}</h3>
          <button className="dash-modal-close" onClick={onClose}>✕</button>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--dash-text)' }}>{message}</p>
        {requireNote && (
          <div className="dash-form-field full">
            <label>Lý do</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nhập lý do..." />
          </div>
        )}
        {error && <p style={{ color: 'var(--dash-danger)', fontSize: '12px', marginTop: '8px' }}>{error}</p>}
        <div className="dash-modal-actions">
          <button className="dash-btn dash-btn-ghost" onClick={onClose} disabled={submitting}>
            Đóng
          </button>
          <button className="dash-btn" onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
