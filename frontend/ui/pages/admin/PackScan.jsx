'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from '@/lib/router'
import AdminLayout from '../../components/dashboard/AdminLayout'
import { api } from '../../api'

// Máy quét mã vạch hoạt động như bàn phím: quét xong tự gõ mã rồi Enter. Ô nhập luôn được đưa con trỏ về để quét liên tục.
function beep(ok) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = ok ? 880 : 220
    g.gain.value = 0.08
    o.connect(g)
    g.connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + (ok ? 0.08 : 0.3))
    o.onended = () => ctx.close()
  } catch {
    // trình duyệt chặn âm thanh: bỏ qua, màu sắc vẫn báo kết quả
  }
}

export default function PackScan() {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState([]) // kết quả các lần quét gần nhất (mới nhất trước)
  const [queue, setQueue] = useState({ waiting: [], packed: [] })
  const [error, setError] = useState('')

  const loadQueue = useCallback(async () => {
    try {
      setQueue(await api.get('/orders/pack-queue'))
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => {
    loadQueue()
    inputRef.current?.focus()
  }, [loadQueue])

  async function submit(e) {
    e.preventDefault()
    const value = code.trim()
    if (!value || busy) return
    setBusy(true)
    setCode('')
    let entry
    try {
      const res = await api.post('/orders/scan-pack', { code: value })
      entry = { value, ok: true, already: res.already, order: res.order, at: new Date() }
      beep(!res.already)
    } catch (err) {
      entry = { value, ok: false, message: err.message, at: new Date() }
      beep(false)
    }
    setLog((l) => [entry, ...l].slice(0, 30))
    setBusy(false)
    await loadQueue()
    inputRef.current?.focus()
  }

  const total = queue.waiting.length + queue.packed.length
  return (
    <AdminLayout activeNav="orders" pageTitle="Đóng gói">
      <div className="dash-card" style={{ marginBottom: '16px' }}>
        <h3 className="form-card-title">Quét mã vạch trên tem để xác nhận đã đóng gói</h3>
        <form onSubmit={submit} style={{ display: 'flex', gap: '8px' }}>
          <input
            ref={inputRef}
            className="dash-input"
            style={{ flex: 1, fontSize: '18px', padding: '12px 14px' }}
            placeholder="Quét hoặc gõ mã vận đơn / mã đơn rồi Enter"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onBlur={() => setTimeout(() => inputRef.current?.focus(), 150)}
            autoComplete="off"
            autoFocus
          />
          <button className="dash-btn" disabled={busy || !code.trim()}>Xác nhận</button>
        </form>
        <p style={{ fontSize: '13px', margin: '12px 0 0' }}>
          Đã đóng gói <strong>{queue.packed.length}</strong> / {total} kiện.{' '}
          {queue.waiting.length > 0 ? <>Còn <strong style={{ color: 'var(--dash-danger, #c0392b)' }}>{queue.waiting.length}</strong> kiện chưa đóng gói.</> : total > 0 ? <strong style={{ color: 'var(--dash-success, #2e7d32)' }}>Đã đóng gói hết.</strong> : null}
          {queue.packed.length > 0 && <button className="dash-btn" style={{ marginLeft: '12px', padding: '6px 14px', fontSize: '12px' }} onClick={() => navigate('/dashboard/shipping/handover')}>Sang bàn giao cho hãng →</button>}
        </p>
        {error && <p style={{ color: 'var(--dash-danger, #c0392b)', fontSize: '13px' }}>{error}</p>}
      </div>

      {log.length > 0 && (
        <div className="dash-card" style={{ marginBottom: '16px' }}>
          <h3 className="form-card-title">Kết quả quét</h3>
          <div style={{ display: 'grid', gap: '6px', fontSize: '13px' }}>
            {log.map((r, i) => (
              <div key={i} style={{ padding: '8px 12px', borderLeft: `4px solid ${r.ok ? (r.already ? '#b26a00' : '#2e7d32') : '#c0392b'}`, background: r.ok ? (r.already ? '#fff4e5' : '#e8f5e9') : '#fdecea' }}>
                {r.ok ? (
                  <>
                    <strong>{r.already ? 'Đã quét trước đó' : '✓ Đã đóng gói'}</strong> · {r.order.code} · {r.order.recipientName}, {r.order.province} · {r.order.quantity} sản phẩm · {r.order.carrier}
                  </>
                ) : (
                  <>
                    <strong>✗ {r.value}</strong>: {r.message}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        <QueueCard title={`Chưa đóng gói (${queue.waiting.length})`} rows={queue.waiting} empty="Không còn kiện nào chờ đóng gói." />
        <QueueCard title={`Đã đóng gói, chờ bàn giao (${queue.packed.length})`} rows={queue.packed} empty="Chưa có kiện nào." />
      </div>
    </AdminLayout>
  )
}

function QueueCard({ title, rows, empty }) {
  return (
    <div className="dash-card">
      <h3 className="form-card-title">{title}</h3>
      {rows.length === 0 ? (
        <p className="dash-empty-state">{empty}</p>
      ) : (
        <div style={{ fontSize: '13px', lineHeight: 1.8, maxHeight: '420px', overflowY: 'auto' }}>
          {rows.map((r) => (
            <div key={r.id}>
              <strong>{r.code}</strong> · {r.recipientName} · {r.quantity} SP · {r.carrier}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
