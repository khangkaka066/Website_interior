'use client'

import { useState, useEffect } from 'react'
import { useNavigate } from '@/lib/router'
import AdminLayout from '../../components/dashboard/AdminLayout'
import { api } from '../../api'

export default function CarrierSettings() {
  const navigate = useNavigate()
  const [carriers, setCarriers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // carrier id being edited
  const [form, setForm] = useState({})
  const [goship, setGoship] = useState({ loading: true, data: null, error: '' })

  async function load() {
    setLoading(true)
    try {
      const list = await api.get('/shipping/carriers')
      setCarriers(list)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Kiểm tra kết nối Goship thật (backend gọi Goship bằng GOSHIP_TOKEN trong .env; trình duyệt không thấy token).
  async function checkGoship() {
    setGoship((g) => ({ ...g, loading: true, error: '' }))
    try {
      setGoship({ loading: false, data: await api.get('/shipping/goship/status'), error: '' })
    } catch (err) {
      setGoship({ loading: false, data: null, error: err.message })
    }
  }

  useEffect(() => {
    load()
    checkGoship()
  }, [])

  function startEdit(carrier) {
    setEditing(carrier.id)
    setForm({
      apiKey: carrier.apiConfig?.apiKey || '',
      shopId: carrier.apiConfig?.shopId || '',
      apiStatus: carrier.apiStatus,
    })
  }

  async function toggleEnabled(carrier) {
    await api.patch(`/shipping/carriers/${carrier.id}`, { enabled: !carrier.enabled })
    load()
  }

  async function handleSave(carrier) {
    await api.patch(`/shipping/carriers/${carrier.id}`, {
      apiConfig: { apiKey: form.apiKey, shopId: form.shopId },
      apiStatus: form.apiKey ? 'connected' : 'disconnected',
    })
    setEditing(null)
    load()
  }

  return (
    <AdminLayout activeNav="shipping" pageTitle="Đơn vị vận chuyển">
      <a className="detail-back-link" href="#" onClick={(e) => { e.preventDefault(); navigate('/dashboard/shipping') }}>
        ← Quay lại Vận chuyển
      </a>

      <div className="dash-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 className="form-card-title" style={{ marginBottom: '4px' }}>Goship <span style={{ color: 'var(--dash-muted)', fontWeight: 400 }}>(gom nhiều hãng vận chuyển)</span></h3>
            {goship.loading ? (
              <span className="order-status-badge status-pending">Đang kiểm tra…</span>
            ) : goship.data?.connected ? (
              <span className="order-status-badge status-delivered">Đã kết nối Goship</span>
            ) : (
              <span className="order-status-badge status-cancelled">{goship.data?.configured === false ? 'Chưa cấu hình' : 'Chưa kết nối được'}</span>
            )}
          </div>
          <button className="dash-btn dash-btn-ghost" onClick={checkGoship} disabled={goship.loading}>Kiểm tra kết nối</button>
        </div>

        {(goship.error || goship.data?.message) && (
          <p style={{ fontSize: '13px', color: 'var(--dash-danger)', marginTop: '10px' }}>{goship.error || goship.data.message}</p>
        )}

        {goship.data?.connected && (
          <>
            <p style={{ fontSize: '13px', color: 'var(--dash-muted)', marginTop: '10px' }}>
              Kết nối bằng một token duy nhất của Goship, <strong>không cần nhập API riêng cho từng hãng</strong>. Goship đang hỗ trợ {goship.data.carriers.length} hãng
              ({goship.data.cities} tỉnh/thành):
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
              {goship.data.carriers.map((c) => (
                <span key={c.name} className="order-status-badge status-pending" title={c.codes.join(', ')}>{c.name}</span>
              ))}
            </div>
          </>
        )}

        {goship.data && !goship.data.connected && (
          <p style={{ fontSize: '12px', color: 'var(--dash-muted)', marginTop: '8px' }}>
            Token Goship được đặt trong <code>backend/.env</code> (<code>GOSHIP_TOKEN</code>) và cần khởi động lại backend sau khi đổi. Token không hiện ở trang này.
          </p>
        )}
      </div>

      <h4 style={{ margin: '0 0 4px', fontSize: '14px' }}>Cấu hình riêng từng hãng</h4>
      <p style={{ fontSize: '12px', color: 'var(--dash-muted)', margin: '0 0 12px' }}>Chỉ cần khi kết nối trực tiếp với một hãng, không qua Goship. Đã dùng Goship thì không cần điền.</p>

      {error && <div className="dash-card" style={{ padding: '16px', color: 'var(--dash-danger)' }}>{error}</div>}

      {loading ? (
        <div className="dash-card" style={{ textAlign: 'center', padding: '40px' }}>Đang tải...</div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {carriers.map((c) => (
            <div className="dash-card" key={c.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 className="form-card-title" style={{ marginBottom: '4px' }}>{c.name} <span style={{ color: 'var(--dash-muted)', fontWeight: 400 }}>({c.code})</span></h3>
                  <span className={`order-status-badge ${c.apiStatus === 'connected' ? 'status-delivered' : 'status-pending'}`}>
                    {c.apiStatus === 'connected' ? 'Đã kết nối API' : 'Chưa kết nối API'}
                  </span>
                  {' '}
                  <span className={`order-status-badge ${c.enabled ? 'status-delivered' : 'status-cancelled'}`}>
                    {c.enabled ? 'Đang bật' : 'Đã tắt'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="dash-btn dash-btn-ghost" onClick={() => toggleEnabled(c)}>
                    {c.enabled ? 'Tắt' : 'Bật'}
                  </button>
                  <button className="dash-btn dash-btn-ghost" onClick={() => startEdit(c)}>Cấu hình API</button>
                </div>
              </div>

              {c.serviceTypes && (
                <p style={{ fontSize: '12px', color: 'var(--dash-muted)', marginTop: '8px' }}>
                  Dịch vụ: {(Array.isArray(c.serviceTypes) ? c.serviceTypes : []).join(', ')}
                </p>
              )}

              {editing === c.id && (
                <div className="dash-form-grid" style={{ marginTop: '16px', borderTop: '1px solid var(--dash-border)', paddingTop: '16px' }}>
                  <div className="dash-form-field">
                    <label>API Key</label>
                    <input value={form.apiKey} onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))} />
                  </div>
                  <div className="dash-form-field">
                    <label>Shop ID</label>
                    <input value={form.shopId} onChange={(e) => setForm((f) => ({ ...f, shopId: e.target.value }))} />
                  </div>
                  <div className="dash-form-field full" style={{ flexDirection: 'row', gap: '8px', justifyContent: 'flex-end' }}>
                    <button className="dash-btn dash-btn-ghost" onClick={() => setEditing(null)}>Hủy</button>
                    <button className="dash-btn" onClick={() => handleSave(c)}>Lưu</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}
