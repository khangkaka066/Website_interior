import { useState } from 'react'
import { api } from '../../../api'

export default function CampaignFormModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '',
    platform: 'META',
    objective: '',
    budgetTotal: '',
    budgetDaily: '',
    startDate: '',
    endDate: '',
    utmCode: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function slugify(text) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }

  async function handleSubmit() {
    if (!form.name || !form.objective || !form.budgetTotal || !form.startDate) {
      setError('Vui lòng điền đầy đủ thông tin bắt buộc.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const campaign = await api.post('/campaigns', {
        name: form.name,
        platform: form.platform,
        objective: form.objective,
        budgetTotal: Number(form.budgetTotal),
        budgetDaily: form.budgetDaily ? Number(form.budgetDaily) : undefined,
        startDate: form.startDate,
        endDate: form.endDate || undefined,
        utmCode: form.utmCode || slugify(form.name),
      })
      onCreated(campaign)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dash-modal-head">
          <h3>Tạo chiến dịch quảng cáo</h3>
          <button className="dash-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="dash-form-grid">
          <div className="dash-form-field full">
            <label>Tên chiến dịch *</label>
            <input value={form.name} onChange={(e) => update('name', e.target.value)} />
          </div>
          <div className="dash-form-field">
            <label>Nền tảng *</label>
            <select value={form.platform} onChange={(e) => update('platform', e.target.value)}>
              <option value="META">Meta (Facebook/Instagram)</option>
              <option value="GOOGLE">Google Ads</option>
              <option value="TIKTOK">TikTok Ads</option>
            </select>
          </div>
          <div className="dash-form-field">
            <label>Mục tiêu *</label>
            <input value={form.objective} onChange={(e) => update('objective', e.target.value)} placeholder="VD: Conversions, Traffic..." />
          </div>
          <div className="dash-form-field">
            <label>Ngân sách tổng (đ) *</label>
            <input type="number" value={form.budgetTotal} onChange={(e) => update('budgetTotal', e.target.value)} />
          </div>
          <div className="dash-form-field">
            <label>Ngân sách/ngày (đ)</label>
            <input type="number" value={form.budgetDaily} onChange={(e) => update('budgetDaily', e.target.value)} />
          </div>
          <div className="dash-form-field">
            <label>Ngày bắt đầu *</label>
            <input type="date" value={form.startDate} onChange={(e) => update('startDate', e.target.value)} />
          </div>
          <div className="dash-form-field">
            <label>Ngày kết thúc</label>
            <input type="date" value={form.endDate} onChange={(e) => update('endDate', e.target.value)} />
          </div>
          <div className="dash-form-field full">
            <label>Mã UTM (utm_campaign)</label>
            <input value={form.utmCode} onChange={(e) => update('utmCode', e.target.value)} placeholder={form.name ? slugify(form.name) : 'tu-dong-tao-tu-ten'} />
          </div>
        </div>

        {error && <p style={{ color: 'var(--dash-danger)', fontSize: '12px', marginTop: '10px' }}>{error}</p>}

        <div className="dash-modal-actions">
          <button className="dash-btn dash-btn-ghost" onClick={onClose} disabled={submitting}>Hủy</button>
          <button className="dash-btn" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Đang tạo...' : 'Tạo chiến dịch'}
          </button>
        </div>
      </div>
    </div>
  )
}
