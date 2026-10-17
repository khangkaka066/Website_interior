'use client'

import { useCallback, useEffect, useState } from 'react'
import AdminLayout from '../../components/dashboard/AdminLayout'
import { api } from '../../api'
import { formatCurrency } from '../../utils/format'

const muted = { fontSize: '12px', color: 'var(--dash-muted)' }
const EMPTY = { code: '', description: '', type: 'FIXED', value: '', maxDiscount: '', minOrder: '', usageLimit: '', perCustomerLimit: '', startsAt: '', endsAt: '', active: true }
const num = (v) => (v === '' || v == null ? null : Number(v))
const dateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '')
const day = (d) => new Date(d).toLocaleDateString('vi-VN')

// Trạng thái hiển thị của một mã: đang chạy / tạm tắt / chưa tới / hết hạn / hết lượt.
function stateOf(c, now = Date.now()) {
  if (!c.active) return { text: 'Đã tắt', cls: 'status-pending' }
  if (c.startsAt && now < new Date(c.startsAt)) return { text: 'Chưa bắt đầu', cls: 'status-processing' }
  if (c.endsAt && now > new Date(c.endsAt)) return { text: 'Hết hạn', cls: 'status-cancelled' }
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) return { text: 'Hết lượt', cls: 'status-cancelled' }
  return { text: 'Đang chạy', cls: 'status-delivered' }
}

const describe = (c) =>
  (c.type === 'FIXED' ? `Giảm ${formatCurrency(c.value)}` : `Giảm ${c.value}%${c.maxDiscount ? `, tối đa ${formatCurrency(c.maxDiscount)}` : ''}`) + (c.minOrder ? ` · đơn từ ${formatCurrency(c.minOrder)}` : '')

// Mã giảm giá khách nhập ở trang thanh toán: giảm cố định hoặc theo %, đơn tối thiểu, giới hạn tổng lượt và lượt mỗi khách.
export default function CouponsAdmin() {
  const [items, setItems] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try {
      setItems((await api.get('/coupons')).items)
    } catch (err) {
      setError(err.message)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  function edit(c) {
    setEditId(c.id)
    setNotice('')
    setError('')
    setForm({
      code: c.code, description: c.description || '', type: c.type, value: String(c.value), maxDiscount: c.maxDiscount ?? '', minOrder: c.minOrder || '',
      usageLimit: c.usageLimit ?? '', perCustomerLimit: c.perCustomerLimit ?? '', startsAt: dateInput(c.startsAt), endsAt: dateInput(c.endsAt), active: c.active,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function reset() {
    setEditId(null)
    setForm(EMPTY)
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    const body = {
      code: form.code,
      description: form.description.trim() || null,
      type: form.type,
      value: num(form.value),
      maxDiscount: form.type === 'PERCENT' ? num(form.maxDiscount) : null,
      minOrder: num(form.minOrder) ?? 0,
      usageLimit: num(form.usageLimit),
      perCustomerLimit: num(form.perCustomerLimit),
      startsAt: form.startsAt || null,
      endsAt: form.endsAt ? `${form.endsAt}T23:59:59` : null, // hết hạn cuối ngày đã chọn
      active: form.active,
    }
    if (body.endsAt) body.endsAt = new Date(body.endsAt).toISOString()
    if (body.startsAt) body.startsAt = new Date(`${body.startsAt}T00:00:00`).toISOString()
    try {
      if (editId) await api.patch(`/coupons/${editId}`, body)
      else await api.post('/coupons', body)
      setNotice(editId ? 'Đã cập nhật mã.' : `Đã tạo mã ${body.code.toUpperCase()}.`)
      reset()
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function toggle(c) {
    try {
      await api.patch(`/coupons/${c.id}`, { active: !c.active })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }
  async function remove(c) {
    if (!window.confirm(`Xóa mã ${c.code}?`)) return
    try {
      await api.delete(`/coupons/${c.id}`)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <AdminLayout activeNav="coupons" pageTitle="Mã giảm giá">
      <div className="dash-card" style={{ padding: '16px', marginBottom: '16px' }}>
        <h3 style={{ marginBottom: '12px' }}>{editId ? `Sửa mã ${form.code}` : 'Tạo mã giảm giá'}</h3>
        <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px', alignItems: 'end' }}>
          <div className="dash-form-field">
            <label>Mã *</label>
            <input value={form.code} onChange={set('code')} maxLength={30} placeholder="VD: GIAM50K" disabled={!!editId} required style={{ textTransform: 'uppercase' }} />
          </div>
          <div className="dash-form-field">
            <label>Loại giảm</label>
            <select className="dash-select" value={form.type} onChange={set('type')}>
              <option value="FIXED">Số tiền cố định (đ)</option>
              <option value="PERCENT">Phần trăm (%)</option>
            </select>
          </div>
          <div className="dash-form-field">
            <label>{form.type === 'FIXED' ? 'Số tiền giảm (đ) *' : 'Phần trăm giảm (%) *'}</label>
            <input type="number" min={1} max={form.type === 'PERCENT' ? 100 : undefined} value={form.value} onChange={set('value')} required />
          </div>
          {form.type === 'PERCENT' && (
            <div className="dash-form-field">
              <label>Giảm tối đa (đ)</label>
              <input type="number" min={1} value={form.maxDiscount} onChange={set('maxDiscount')} placeholder="Không giới hạn" />
            </div>
          )}
          <div className="dash-form-field">
            <label>Đơn tối thiểu (đ)</label>
            <input type="number" min={0} value={form.minOrder} onChange={set('minOrder')} placeholder="0" />
          </div>
          <div className="dash-form-field">
            <label>Tổng số lượt dùng</label>
            <input type="number" min={1} value={form.usageLimit} onChange={set('usageLimit')} placeholder="Không giới hạn" />
          </div>
          <div className="dash-form-field">
            <label>Lượt tối đa mỗi khách</label>
            <input type="number" min={1} value={form.perCustomerLimit} onChange={set('perCustomerLimit')} placeholder="Không giới hạn" />
          </div>
          <div className="dash-form-field">
            <label>Bắt đầu</label>
            <input type="date" value={form.startsAt} onChange={set('startsAt')} />
          </div>
          <div className="dash-form-field">
            <label>Kết thúc (hết ngày này)</label>
            <input type="date" value={form.endsAt} onChange={set('endsAt')} />
          </div>
          <div className="dash-form-field" style={{ gridColumn: '1 / -1' }}>
            <label>Mô tả (hiện cho khách khi áp mã)</label>
            <input value={form.description} onChange={set('description')} maxLength={200} placeholder="VD: Giảm 50k cho đơn từ 500k" />
          </div>
          <label style={{ fontSize: '13px', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input type="checkbox" checked={form.active} onChange={set('active')} /> Đang bật
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="dash-btn" disabled={busy}>{busy ? 'Đang lưu…' : editId ? 'Lưu thay đổi' : 'Tạo mã'}</button>
            {editId && <button type="button" className="dash-btn dash-btn-ghost" onClick={reset}>Hủy</button>}
          </div>
        </form>
        {error && <p style={{ color: 'var(--dash-danger)', fontSize: '13px', marginTop: '10px' }} role="alert">{error}</p>}
        {notice && <p style={{ color: 'var(--dash-success)', fontSize: '13px', marginTop: '10px' }} role="status">{notice}</p>}
      </div>

      <div className="dash-card" style={{ padding: '16px' }}>
        {!items && !error && <p style={muted}>Đang tải…</p>}
        {items && items.length === 0 && <p style={muted}>Chưa có mã giảm giá nào.</p>}
        {items && items.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="dash-table">
              <thead>
                <tr><th>Mã</th><th>Ưu đãi</th><th>Đã dùng</th><th>Thời gian</th><th>Trạng thái</th><th /></tr>
              </thead>
              <tbody>
                {items.map((c) => {
                  const st = stateOf(c)
                  return (
                    <tr key={c.id}>
                      <td><strong>{c.code}</strong>{c.description && <div style={muted}>{c.description}</div>}</td>
                      <td>{describe(c)}{c.perCustomerLimit ? <div style={muted}>Tối đa {c.perCustomerLimit} lượt/khách</div> : null}</td>
                      <td>{c.usedCount}{c.usageLimit != null ? ` / ${c.usageLimit}` : ''}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{c.startsAt || c.endsAt ? `${c.startsAt ? day(c.startsAt) : '…'} → ${c.endsAt ? day(c.endsAt) : '…'}` : 'Không giới hạn'}</td>
                      <td><span className={`order-status-badge ${st.cls}`}>{st.text}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button type="button" className="dash-btn dash-btn-ghost" onClick={() => edit(c)}>Sửa</button>{' '}
                        <button type="button" className="dash-btn dash-btn-ghost" onClick={() => toggle(c)}>{c.active ? 'Tắt' : 'Bật'}</button>{' '}
                        <button type="button" className="dash-btn dash-btn-ghost" onClick={() => remove(c)} disabled={c.usedCount > 0} title={c.usedCount > 0 ? 'Mã đã có đơn dùng: chỉ tắt được' : ''}>Xóa</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
