import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/dashboard/AdminLayout'
import { api } from '../../api'

export default function CarrierSettings() {
  const navigate = useNavigate()
  const [carriers, setCarriers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // carrier id being edited
  const [form, setForm] = useState({})

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

  useEffect(() => {
    load()
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
