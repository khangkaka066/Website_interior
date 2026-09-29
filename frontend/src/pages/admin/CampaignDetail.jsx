import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/dashboard/AdminLayout'
import { api } from '../../api'
import { AD_PLATFORM, CAMPAIGN_STATUS, CREATIVE_TYPE, platformLabel, campaignStatusLabel } from '../../constants/campaign'
import { formatCurrency, formatDate } from '../../utils/format'

export default function CampaignDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingSpend, setEditingSpend] = useState(false)
  const [spendInput, setSpendInput] = useState('')
  const [addingAdSet, setAddingAdSet] = useState(false)
  const [adSetForm, setAdSetForm] = useState({ name: '', audienceAgeMin: '', audienceAgeMax: '', audienceGender: 'all', audienceLocation: '', interests: '', budget: '' })
  const [addingAdFor, setAddingAdFor] = useState(null)
  const [adForm, setAdForm] = useState({ name: '', creativeType: 'IMAGE', headline: '', bodyCopy: '', ctaLabel: '', imageUrl: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get(`/campaigns/${id}`)
      setCampaign(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function handleStatusChange(status) {
    await api.patch(`/campaigns/${id}`, { status })
    await load()
  }

  async function handleSaveSpend() {
    await api.patch(`/campaigns/${id}`, { spentAmount: Number(spendInput) })
    setEditingSpend(false)
    await load()
  }

  async function handleAddAdSet() {
    if (!adSetForm.name || !adSetForm.budget) return
    await api.post(`/campaigns/${id}/adsets`, {
      name: adSetForm.name,
      audienceAgeMin: adSetForm.audienceAgeMin ? Number(adSetForm.audienceAgeMin) : undefined,
      audienceAgeMax: adSetForm.audienceAgeMax ? Number(adSetForm.audienceAgeMax) : undefined,
      audienceGender: adSetForm.audienceGender,
      audienceLocation: adSetForm.audienceLocation,
      interests: adSetForm.interests ? adSetForm.interests.split(',').map((s) => s.trim()).filter(Boolean) : [],
      budget: Number(adSetForm.budget),
    })
    setAddingAdSet(false)
    setAdSetForm({ name: '', audienceAgeMin: '', audienceAgeMax: '', audienceGender: 'all', audienceLocation: '', interests: '', budget: '' })
    await load()
  }

  async function handleAddAd(adSetId) {
    if (!adForm.name || !adForm.headline) return
    await api.post(`/campaigns/${id}/adsets/${adSetId}/ads`, adForm)
    setAddingAdFor(null)
    setAdForm({ name: '', creativeType: 'IMAGE', headline: '', bodyCopy: '', ctaLabel: '', imageUrl: '' })
    await load()
  }

  async function handleDeleteAdSet(adSetId) {
    if (!window.confirm('Xóa Ad Set này và toàn bộ quảng cáo bên trong?')) return
    await api.delete(`/campaigns/${id}/adsets/${adSetId}`)
    await load()
  }

  async function handleDeleteAd(adSetId, adId) {
    if (!window.confirm('Xóa quảng cáo này?')) return
    await api.delete(`/campaigns/${id}/adsets/${adSetId}/ads/${adId}`)
    await load()
  }

  if (loading) {
    return (
      <AdminLayout activeNav="campaigns" pageTitle="Quảng cáo">
        <div className="dash-card" style={{ textAlign: 'center', padding: '40px' }}>Đang tải...</div>
      </AdminLayout>
    )
  }

  if (error || !campaign) {
    return (
      <AdminLayout activeNav="campaigns" pageTitle="Lỗi">
        <div className="dash-card" style={{ textAlign: 'center', padding: '40px' }}>
          <p>{error || 'Không tìm thấy chiến dịch.'}</p>
          <button className="dash-btn" onClick={() => navigate('/dashboard/campaigns')}>Quay lại</button>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout activeNav="campaigns" pageTitle={campaign.name}>
      <a className="detail-back-link" href="#" onClick={(e) => { e.preventDefault(); navigate('/dashboard/campaigns') }}>
        ← Quay lại danh sách chiến dịch
      </a>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--dash-heading)' }}>{campaign.name}</h2>
          <span className={`order-status-badge ${AD_PLATFORM[campaign.platform]?.cls || ''}`}>{platformLabel(campaign.platform)}</span>
          <span className={`order-status-badge ${CAMPAIGN_STATUS[campaign.status]?.cls || ''}`}>{campaignStatusLabel(campaign.status)}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select className="dash-select" value={campaign.status} onChange={(e) => handleStatusChange(e.target.value)}>
            {Object.entries(CAMPAIGN_STATUS).map(([key, v]) => (
              <option key={key} value={key}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      <section className="kpi-grid" style={{ marginBottom: '24px' }}>
        <div className="kpi-card"><strong className="kpi-value">{formatCurrency(campaign.budgetTotal)}</strong><span className="kpi-label">Ngân sách tổng</span></div>
        <div className="kpi-card"><strong className="kpi-value">{formatCurrency(campaign.spentAmount)}</strong><span className="kpi-label">Đã chi tiêu</span></div>
        <div className="kpi-card"><strong className="kpi-value">{campaign.orders}</strong><span className="kpi-label">Đơn hàng</span></div>
        <div className="kpi-card"><strong className="kpi-value">{formatCurrency(campaign.revenue)}</strong><span className="kpi-label">Doanh thu</span></div>
        <div className="kpi-card"><strong className="kpi-value">{campaign.roas.toFixed(2)}x</strong><span className="kpi-label">ROAS</span></div>
        <div className="kpi-card"><strong className="kpi-value">{formatCurrency(campaign.cpa)}</strong><span className="kpi-label">CPA</span></div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div className="dash-card">
          <h3 className="form-card-title">Thông tin chiến dịch</h3>
          <div style={{ fontSize: '13px', lineHeight: '1.9' }}>
            <div><strong>Mục tiêu:</strong> {campaign.objective}</div>
            <div><strong>Thời gian:</strong> {formatDate(campaign.startDate)}{campaign.endDate ? ` – ${formatDate(campaign.endDate)}` : ' (không giới hạn)'}</div>
            <div><strong>Ngân sách/ngày:</strong> {campaign.budgetDaily ? formatCurrency(campaign.budgetDaily) : '—'}</div>
            <div><strong>Mã UTM:</strong> <code>{campaign.utmCode}</code></div>
            <div style={{ fontSize: '11px', color: 'var(--dash-muted)', marginTop: '6px' }}>
              Link theo dõi: <code>?utm_source=...&utm_medium=...&utm_campaign={campaign.utmCode}</code>
            </div>
          </div>
        </div>

        <div className="dash-card">
          <div className="dash-card-head">
            <h3 className="form-card-title" style={{ marginBottom: 0 }}>Cập nhật chi tiêu thực tế</h3>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--dash-muted)', marginBottom: '10px' }}>
            Không có kết nối API thật tới Meta/Google/TikTok — admin tự cập nhật số tiền đã chi để hệ thống tính ROAS/CPA/CAC.
          </p>
          {editingSpend ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input className="dash-input" type="number" value={spendInput} onChange={(e) => setSpendInput(e.target.value)} style={{ flex: 1 }} />
              <button className="dash-btn" onClick={handleSaveSpend}>Lưu</button>
              <button className="dash-btn dash-btn-ghost" onClick={() => setEditingSpend(false)}>Hủy</button>
            </div>
          ) : (
            <button className="dash-btn dash-btn-ghost" onClick={() => { setSpendInput(String(campaign.spentAmount)); setEditingSpend(true) }}>
              Cập nhật số tiền đã chi ({formatCurrency(campaign.spentAmount)})
            </button>
          )}
        </div>
      </div>

      <div className="dash-card dash-card-wide">
        <div className="dash-card-head">
          <h3>Ad Sets & Quảng cáo</h3>
          <button className="dash-btn dash-btn-ghost" onClick={() => setAddingAdSet((v) => !v)}>
            {addingAdSet ? 'Đóng' : '+ Thêm Ad Set'}
          </button>
        </div>

        {addingAdSet && (
          <div className="dash-form-grid" style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid var(--dash-border)' }}>
            <div className="dash-form-field full">
              <label>Tên Ad Set *</label>
              <input value={adSetForm.name} onChange={(e) => setAdSetForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="dash-form-field">
              <label>Tuổi từ</label>
              <input type="number" value={adSetForm.audienceAgeMin} onChange={(e) => setAdSetForm((f) => ({ ...f, audienceAgeMin: e.target.value }))} />
            </div>
            <div className="dash-form-field">
              <label>Tuổi đến</label>
              <input type="number" value={adSetForm.audienceAgeMax} onChange={(e) => setAdSetForm((f) => ({ ...f, audienceAgeMax: e.target.value }))} />
            </div>
            <div className="dash-form-field">
              <label>Giới tính</label>
              <select value={adSetForm.audienceGender} onChange={(e) => setAdSetForm((f) => ({ ...f, audienceGender: e.target.value }))}>
                <option value="all">Tất cả</option>
                <option value="male">Nam</option>
                <option value="female">Nữ</option>
              </select>
            </div>
            <div className="dash-form-field">
              <label>Khu vực</label>
              <input value={adSetForm.audienceLocation} onChange={(e) => setAdSetForm((f) => ({ ...f, audienceLocation: e.target.value }))} placeholder="VD: TP. Hồ Chí Minh" />
            </div>
            <div className="dash-form-field full">
              <label>Sở thích (cách nhau bởi dấu phẩy)</label>
              <input value={adSetForm.interests} onChange={(e) => setAdSetForm((f) => ({ ...f, interests: e.target.value }))} placeholder="nội thất, trang trí nhà cửa" />
            </div>
            <div className="dash-form-field">
              <label>Ngân sách Ad Set (đ) *</label>
              <input type="number" value={adSetForm.budget} onChange={(e) => setAdSetForm((f) => ({ ...f, budget: e.target.value }))} />
            </div>
            <div className="dash-form-field full" style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <button className="dash-btn" onClick={handleAddAdSet}>Lưu Ad Set</button>
            </div>
          </div>
        )}

        {campaign.adSets.length === 0 ? (
          <p className="dash-empty-state">Chưa có Ad Set nào.</p>
        ) : (
          campaign.adSets.map((adSet) => (
            <div key={adSet.id} style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid var(--dash-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <strong style={{ fontSize: '14px', color: 'var(--dash-heading)' }}>{adSet.name}</strong>
                  <div style={{ fontSize: '12px', color: 'var(--dash-muted)', marginTop: '4px' }}>
                    {adSet.audienceGender !== 'all' && (adSet.audienceGender === 'male' ? 'Nam' : 'Nữ')}
                    {(adSet.audienceAgeMin || adSet.audienceAgeMax) && ` · ${adSet.audienceAgeMin || '?'}-${adSet.audienceAgeMax || '?'} tuổi`}
                    {adSet.audienceLocation && ` · ${adSet.audienceLocation}`}
                    {adSet.interests?.length > 0 && ` · ${adSet.interests.join(', ')}`}
                    {' · Ngân sách: '}{formatCurrency(adSet.budget)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="dash-btn dash-btn-ghost" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setAddingAdFor(addingAdFor === adSet.id ? null : adSet.id)}>
                    + Thêm quảng cáo
                  </button>
                  <button className="dash-btn dash-btn-ghost" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => handleDeleteAdSet(adSet.id)}>
                    Xóa Ad Set
                  </button>
                </div>
              </div>

              {addingAdFor === adSet.id && (
                <div className="dash-form-grid" style={{ marginTop: '14px', padding: '14px', background: 'var(--dash-body-bg)' }}>
                  <div className="dash-form-field">
                    <label>Tên quảng cáo *</label>
                    <input value={adForm.name} onChange={(e) => setAdForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="dash-form-field">
                    <label>Loại creative</label>
                    <select value={adForm.creativeType} onChange={(e) => setAdForm((f) => ({ ...f, creativeType: e.target.value }))}>
                      {Object.entries(CREATIVE_TYPE).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="dash-form-field full">
                    <label>Tiêu đề *</label>
                    <input value={adForm.headline} onChange={(e) => setAdForm((f) => ({ ...f, headline: e.target.value }))} />
                  </div>
                  <div className="dash-form-field full">
                    <label>Nội dung</label>
                    <textarea value={adForm.bodyCopy} onChange={(e) => setAdForm((f) => ({ ...f, bodyCopy: e.target.value }))} />
                  </div>
                  <div className="dash-form-field">
                    <label>CTA</label>
                    <input value={adForm.ctaLabel} onChange={(e) => setAdForm((f) => ({ ...f, ctaLabel: e.target.value }))} placeholder="Mua ngay" />
                  </div>
                  <div className="dash-form-field">
                    <label>URL hình ảnh</label>
                    <input value={adForm.imageUrl} onChange={(e) => setAdForm((f) => ({ ...f, imageUrl: e.target.value }))} />
                  </div>
                  <div className="dash-form-field full" style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                    <button className="dash-btn" onClick={() => handleAddAd(adSet.id)}>Lưu quảng cáo</button>
                  </div>
                </div>
              )}

              {adSet.ads.length > 0 && (
                <table className="dash-table" style={{ marginTop: '14px' }}>
                  <thead>
                    <tr>
                      <th>Tên</th>
                      <th>Loại</th>
                      <th>Tiêu đề</th>
                      <th>CTA</th>
                      <th>Trạng thái</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adSet.ads.map((ad) => (
                      <tr key={ad.id}>
                        <td>{ad.name}</td>
                        <td>{CREATIVE_TYPE[ad.creativeType]}</td>
                        <td>{ad.headline}</td>
                        <td>{ad.ctaLabel || '—'}</td>
                        <td><span className={`order-status-badge ${CAMPAIGN_STATUS[ad.status]?.cls || ''}`}>{campaignStatusLabel(ad.status)}</span></td>
                        <td>
                          <button className="dash-btn dash-btn-ghost" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => handleDeleteAd(adSet.id, ad.id)}>
                            Xóa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))
        )}
      </div>
    </AdminLayout>
  )
}
