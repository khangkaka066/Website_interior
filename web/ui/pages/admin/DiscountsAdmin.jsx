'use client'

import { useCallback, useEffect, useState } from 'react'
import AdminLayout from '../../components/dashboard/AdminLayout'
import { api } from '../../api'
import { formatCurrency } from '../../utils/format'

const muted = { fontSize: '12px', color: 'var(--dash-text-muted, #888)' }

// Giảm giá theo SKU: nhập SKU (của sản phẩm hoặc của một phân loại) + phần trăm giảm. Website hiện giá đã giảm kèm giá gốc gạch ngang,
// và đơn hàng tính tiền theo giá đã giảm. SKU sản phẩm giảm mọi phân loại; SKU phân loại chỉ giảm phân loại đó (ưu tiên hơn).
export default function DiscountsAdmin() {
  const [rules, setRules] = useState([])
  const [edits, setEdits] = useState({}) // sku -> % đang gõ dở
  const [form, setForm] = useState({ sku: '', percent: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try {
      setRules((await api.get('/discounts')).rules)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  async function persist(next, doneMessage) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const res = await api.put('/discounts', { rules: next.map(({ sku, percent }) => ({ sku, percent })) })
      setRules(res.rules)
      setEdits({})
      setNotice(doneMessage)
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setSaving(false)
    }
  }

  async function add(e) {
    e.preventDefault()
    const sku = form.sku.trim()
    const percent = Number(form.percent)
    if (!sku) return setError('Vui lòng nhập SKU.')
    if (!Number.isInteger(percent) || percent < 1 || percent > 90) return setError('Phần trăm giảm phải là số nguyên từ 1 đến 90.')
    const key = sku.toLowerCase()
    const next = [...rules.filter((r) => r.sku.toLowerCase() !== key), { sku, percent }] // nhập lại SKU đã có thì cập nhật %
    if (await persist(next, `Đã áp dụng giảm ${percent}% cho SKU ${sku}.`)) setForm({ sku: '', percent: '' })
  }

  const dirty = (r) => edits[r.sku] !== undefined && Number(edits[r.sku]) !== r.percent

  return (
    <AdminLayout activeNav="discounts" pageTitle="Giảm giá theo SKU">
      <div className="dash-card" style={{ padding: '16px', marginBottom: '16px' }}>
        <form onSubmit={add} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="dash-form-field" style={{ flex: '1 1 240px' }}>
            <label>SKU sản phẩm hoặc phân loại</label>
            <input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} maxLength={100} placeholder="Ví dụ: REM-01" />
          </div>
          <div className="dash-form-field" style={{ width: '140px' }}>
            <label>Giảm (%)</label>
            <input type="number" min={1} max={90} step={1} value={form.percent} onChange={(e) => setForm((f) => ({ ...f, percent: e.target.value }))} placeholder="10" />
          </div>
          <button className="dash-btn" disabled={saving}>{saving ? 'Đang lưu...' : 'Áp dụng'}</button>
        </form>
        <p style={{ ...muted, marginTop: '10px' }}>
          SKU của sản phẩm sẽ giảm mọi phân loại; SKU của một phân loại chỉ giảm phân loại đó (ưu tiên hơn). Nhập lại SKU đã có để đổi phần trăm.
          Thay đổi có hiệu lực ngay trên website, kể cả giá tính tiền khi đặt hàng.
        </p>
        {error && <p style={{ color: 'var(--dash-danger)', fontSize: '13px', marginTop: '10px' }} role="alert">{error}</p>}
        {notice && <p style={{ color: 'var(--dash-success, #1a7f37)', fontSize: '13px', marginTop: '10px' }} role="status">{notice}</p>}
      </div>

      {loading ? (
        <div className="dash-card" style={{ textAlign: 'center', padding: '40px' }}>Đang tải...</div>
      ) : rules.length === 0 ? (
        <div className="dash-card" style={{ textAlign: 'center', padding: '40px' }}>
          <p className="dash-empty-state">Chưa có SKU nào được giảm giá.</p>
        </div>
      ) : (
        <div className="dash-card dash-card-wide">
          <table className="dash-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Áp dụng cho</th>
                <th>Giá gốc</th>
                <th>Giảm (%)</th>
                <th>Giá sau giảm</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => {
                const pct = edits[r.sku] !== undefined ? Number(edits[r.sku]) : r.percent
                const after = r.found && pct >= 1 && pct <= 90 ? Math.max(1, Math.round(r.price * (1 - pct / 100))) : null
                return (
                  <tr key={r.sku}>
                    <td><strong>{r.sku}</strong></td>
                    <td>
                      {r.found ? (
                        <>
                          {r.name}
                          <div style={muted}>{r.kind === 'variant' ? `Phân loại: ${r.label}` : 'Toàn bộ sản phẩm'}</div>
                        </>
                      ) : (
                        <span style={{ color: 'var(--dash-danger)' }}>Không còn SKU này trong kho sản phẩm</span>
                      )}
                    </td>
                    <td>{r.found ? formatCurrency(r.price) : '—'}</td>
                    <td>
                      <input
                        type="number" min={1} max={90} step={1} style={{ width: '80px' }}
                        value={edits[r.sku] ?? r.percent}
                        onChange={(e) => setEdits((m) => ({ ...m, [r.sku]: e.target.value }))}
                      />
                    </td>
                    <td>{after ? <strong>{formatCurrency(after)}</strong> : '—'}</td>
                    <td>
                      <button
                        className="dash-btn-outline" disabled={saving || !dirty(r)}
                        onClick={() => persist(rules.map((x) => (x.sku === r.sku ? { ...x, percent: Number(edits[r.sku]) } : x)), `Đã đổi SKU ${r.sku} thành giảm ${edits[r.sku]}%.`)}
                      >
                        Lưu
                      </button>{' '}
                      <button
                        className="dash-btn-outline" disabled={saving}
                        onClick={() => persist(rules.filter((x) => x.sku !== r.sku), `Đã bỏ giảm giá cho SKU ${r.sku}.`)}
                      >
                        Bỏ giảm giá
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  )
}
