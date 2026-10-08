'use client'

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from '@/lib/router'
import AdminLayout from '../../components/dashboard/AdminLayout'
import CampaignFormModal from '../../components/dashboard/campaigns/CampaignFormModal'
import { api } from '../../api'
import { AD_PLATFORM, CAMPAIGN_STATUS, platformLabel, campaignStatusLabel } from '../../constants/campaign'
import { formatCurrency, formatDate } from '../../utils/format'

export default function CampaignList() {
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [platform, setPlatform] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (platform) params.set('platform', platform)
      const data = await api.get(`/campaigns?${params.toString()}`)
      setCampaigns(data.items)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [status, platform])

  useEffect(() => {
    load()
  }, [load])

  const totals = campaigns.reduce(
    (acc, c) => ({
      spent: acc.spent + Number(c.spentAmount),
      revenue: acc.revenue + c.revenue,
      orders: acc.orders + c.orders,
    }),
    { spent: 0, revenue: 0, orders: 0 },
  )

  return (
    <AdminLayout activeNav="campaigns" pageTitle="Quản lý quảng cáo" headerActions={
      <button className="dash-btn" onClick={() => setShowCreate(true)}>+ Tạo chiến dịch</button>
    }>
      <section className="kpi-grid" style={{ marginBottom: '20px' }}>
        <div className="kpi-card">
          <strong className="kpi-value">{campaigns.length}</strong>
          <span className="kpi-label">Chiến dịch</span>
        </div>
        <div className="kpi-card">
          <strong className="kpi-value">{formatCurrency(totals.spent)}</strong>
          <span className="kpi-label">Tổng chi tiêu</span>
        </div>
        <div className="kpi-card">
          <strong className="kpi-value">{formatCurrency(totals.revenue)}</strong>
          <span className="kpi-label">Doanh thu quy về quảng cáo</span>
        </div>
        <div className="kpi-card">
          <strong className="kpi-value">{totals.spent > 0 ? (totals.revenue / totals.spent).toFixed(2) : '0.00'}x</strong>
          <span className="kpi-label">ROAS trung bình</span>
        </div>
      </section>

      <div className="dash-toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="dash-select">
          <option value="">Tất cả trạng thái</option>
          {Object.entries(CAMPAIGN_STATUS).map(([key, v]) => (
            <option key={key} value={key}>{v.label}</option>
          ))}
        </select>
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="dash-select">
          <option value="">Tất cả nền tảng</option>
          {Object.entries(AD_PLATFORM).map(([key, v]) => (
            <option key={key} value={key}>{v.label}</option>
          ))}
        </select>
      </div>

      {error && <div className="dash-card" style={{ padding: '16px', color: 'var(--dash-danger)' }}>{error}</div>}

      {loading ? (
        <div className="dash-card" style={{ textAlign: 'center', padding: '40px' }}>Đang tải...</div>
      ) : campaigns.length === 0 ? (
        <div className="dash-card" style={{ textAlign: 'center', padding: '40px' }}>
          <p className="dash-empty-state">Chưa có chiến dịch nào.</p>
        </div>
      ) : (
        <div className="dash-card dash-card-wide">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Tên chiến dịch</th>
                <th>Nền tảng</th>
                <th>Trạng thái</th>
                <th>Ad Set / Ads</th>
                <th>Ngân sách</th>
                <th>Đã chi</th>
                <th>Đơn hàng</th>
                <th>Doanh thu</th>
                <th>ROAS</th>
                <th>Thời gian chạy</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/dashboard/campaigns/${c.id}`)}>
                  <td><a href="#" onClick={(e) => e.preventDefault()}>{c.name}</a></td>
                  <td><span className={`order-status-badge ${AD_PLATFORM[c.platform]?.cls || ''}`}>{platformLabel(c.platform)}</span></td>
                  <td><span className={`order-status-badge ${CAMPAIGN_STATUS[c.status]?.cls || ''}`}>{campaignStatusLabel(c.status)}</span></td>
                  <td>{c.adSetCount} / {c.adCount}</td>
                  <td>{formatCurrency(c.budgetTotal)}</td>
                  <td>{formatCurrency(c.spentAmount)}</td>
                  <td>{c.orders}</td>
                  <td>{formatCurrency(c.revenue)}</td>
                  <td>{c.roas.toFixed(2)}x</td>
                  <td>{formatDate(c.startDate)}{c.endDate ? ` – ${formatDate(c.endDate)}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CampaignFormModal
          onClose={() => setShowCreate(false)}
          onCreated={(campaign) => {
            setShowCreate(false)
            navigate(`/dashboard/campaigns/${campaign.id}`)
          }}
        />
      )}
    </AdminLayout>
  )
}
