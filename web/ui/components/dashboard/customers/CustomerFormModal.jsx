'use client'

import { useState } from 'react'
import { api } from '../../../api'

export default function CustomerFormModal({ customer, onClose, onCreated, onUpdated }) {
  const isEdit = !!customer
  const [form, setForm] = useState({
    name: customer?.name || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    dob: customer?.dob ? customer.dob.slice(0, 10) : '',
    gender: customer?.gender || '',
    tags: customer?.tags?.join(', ') || '',
    note: '',
    recipientName: '',
    addressPhone: '',
    addressLine: '',
    ward: '',
    district: '',
    province: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit() {
    if (!form.name || !form.phone) {
      setError('Vui lòng nhập họ tên và số điện thoại.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const tags = form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : []

      if (isEdit) {
        const updated = await api.patch(`/customers/${customer.id}`, {
          name: form.name,
          email: form.email || null,
          phone: form.phone,
          dob: form.dob || null,
          gender: form.gender || null,
          tags,
        })
        onUpdated(updated)
        return
      }

      const hasAddress = form.addressLine && form.province
      const created = await api.post('/customers', {
        name: form.name,
        email: form.email || undefined,
        phone: form.phone,
        dob: form.dob || undefined,
        gender: form.gender || undefined,
        tags,
        address: hasAddress
          ? {
              recipientName: form.recipientName || form.name,
              phone: form.addressPhone || form.phone,
              addressLine: form.addressLine,
              ward: form.ward,
              district: form.district,
              province: form.province,
            }
          : undefined,
      })
      if (form.note) {
        await api.post(`/customers/${created.id}/notes`, { content: form.note })
      }
      onCreated(created)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dash-modal-head">
          <h3>{isEdit ? 'Chỉnh sửa khách hàng' : 'Thêm khách hàng'}</h3>
          <button className="dash-modal-close" onClick={onClose}>✕</button>
        </div>

        <h4 className="form-card-title" style={{ fontSize: '13px' }}>Thông tin cơ bản</h4>
        <div className="dash-form-grid">
          <div className="dash-form-field">
            <label>Họ và tên *</label>
            <input value={form.name} onChange={(e) => update('name', e.target.value)} />
          </div>
          <div className="dash-form-field">
            <label>Email</label>
            <input value={form.email} onChange={(e) => update('email', e.target.value)} />
          </div>
          <div className="dash-form-field">
            <label>Số điện thoại *</label>
            <input value={form.phone} onChange={(e) => update('phone', e.target.value)} />
          </div>
          <div className="dash-form-field">
            <label>Ngày sinh</label>
            <input type="date" value={form.dob} onChange={(e) => update('dob', e.target.value)} />
          </div>
          <div className="dash-form-field">
            <label>Giới tính</label>
            <select value={form.gender} onChange={(e) => update('gender', e.target.value)}>
              <option value="">—</option>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
              <option value="other">Khác</option>
            </select>
          </div>
          <div className="dash-form-field">
            <label>Tags (cách nhau bởi dấu phẩy)</label>
            <input value={form.tags} onChange={(e) => update('tags', e.target.value)} placeholder="VIP, Frequent Buyer" />
          </div>
        </div>

        {!isEdit && (
          <>
            <h4 className="form-card-title" style={{ fontSize: '13px', marginTop: '16px' }}>Địa chỉ mặc định (tùy chọn)</h4>
            <div className="dash-form-grid">
              <div className="dash-form-field">
                <label>Tên người nhận</label>
                <input value={form.recipientName} onChange={(e) => update('recipientName', e.target.value)} />
              </div>
              <div className="dash-form-field">
                <label>SĐT người nhận</label>
                <input value={form.addressPhone} onChange={(e) => update('addressPhone', e.target.value)} />
              </div>
              <div className="dash-form-field full">
                <label>Địa chỉ</label>
                <input value={form.addressLine} onChange={(e) => update('addressLine', e.target.value)} />
              </div>
              <div className="dash-form-field">
                <label>Phường/Xã</label>
                <input value={form.ward} onChange={(e) => update('ward', e.target.value)} />
              </div>
              <div className="dash-form-field">
                <label>Quận/Huyện</label>
                <input value={form.district} onChange={(e) => update('district', e.target.value)} />
              </div>
              <div className="dash-form-field">
                <label>Tỉnh/Thành phố</label>
                <input value={form.province} onChange={(e) => update('province', e.target.value)} />
              </div>
            </div>

            <h4 className="form-card-title" style={{ fontSize: '13px', marginTop: '16px' }}>Ghi chú nội bộ</h4>
            <div className="dash-form-field full">
              <textarea value={form.note} onChange={(e) => update('note', e.target.value)} placeholder="Chỉ admin nhìn thấy..." />
            </div>
          </>
        )}

        {error && <p style={{ color: 'var(--dash-danger)', fontSize: '12px', marginTop: '10px' }}>{error}</p>}

        <div className="dash-modal-actions">
          <button className="dash-btn dash-btn-ghost" onClick={onClose} disabled={submitting}>Hủy</button>
          <button className="dash-btn" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Lưu khách hàng'}
          </button>
        </div>
      </div>
    </div>
  )
}
