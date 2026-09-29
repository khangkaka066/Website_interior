import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Chart from 'react-apexcharts'
import AdminLayout from '../../components/dashboard/AdminLayout'
import { api } from '../../api'
import { AD_PLATFORM, platformLabel } from '../../constants/campaign'
import { formatCurrency } from '../../utils/format'

const RANGES = [
  { id: 'today', label: 'Hôm nay' },
  { id: '7d', label: '7 ngày' },
  { id: '30d', label: '30 ngày' },
  { id: 'month', label: 'Tháng này' },
]

const INSIGHT_ICON = { positive: '📈', negative: '📉', warning: '⚠️', neutral: 'ℹ️' }

export default function AnalyticsDashboard() {
  const navigate = useNavigate()
  const [range, setRange] = useState('30d')
  const [overview, setOverview] = useState(null)
  const [funnel, setFunnel] = useState(null)
  const [ads, setAds] = useState(null)
  const [insights, setInsights] = useState([])
  const [metric, setMetric] = useState('revenue')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get(`/analytics/overview?range=${range}`),
      api.get(`/analytics/funnel?range=${range}`),
      api.get(`/analytics/ads-performance?range=${range}`),
      api.get(`/analytics/insights?range=${range}`),
    ])
      .then(([o, f, a, i]) => {
        setOverview(o)
        setFunnel(f)
        setAds(a)
        setInsights(i.insights)
      })
      .finally(() => setLoading(false))
  }, [range])

  const chartOptions = {
    chart: { type: 'area', toolbar: { show: false } },
    colors: ['#b5602f'],
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 3 },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.28, opacityTo: 0, stops: [0, 90, 100] } },
    grid: { borderColor: '#ece0d6' },
    legend: { show: false },
    xaxis: {
      categories: overview?.trend?.map((t) => t.label) || [],
      labels: { style: { colors: '#a89685' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { style: { colors: '#a89685' } } },
    tooltip: { theme: 'light' },
  }
  const chartSeries = [{ name: metric === 'revenue' ? 'Doanh thu' : 'Đơn hàng', data: overview?.trend?.map((t) => t[metric]) || [] }]

  const maxFunnel = funnel ? Math.max(...funnel.stages.map((s) => s.count), 1) : 1

  return (
    <AdminLayout activeNav="analytics" pageTitle="Báo cáo & Phân tích">
      <div className="dash-toolbar" style={{ justifyContent: 'flex-end', marginBottom: '20px' }}>
        {RANGES.map((r) => (
          <button key={r.id} className={`dash-btn dash-btn-ghost ${range === r.id ? 'page-btn-active' : ''}`} onClick={() => setRange(r.id)}>
            {r.label}
          </button>
        ))}
      </div>

      {loading || !overview ? (
        <div className="dash-card" style={{ textAlign: 'center', padding: '40px' }}>Đang tải...</div>
      ) : (
        <>
          <section className="kpi-grid" style={{ marginBottom: '20px' }}>
            <div className="kpi-card">
              <strong className="kpi-value">{formatCurrency(overview.revenue)}</strong>
              <span className="kpi-label">Doanh thu {overview.revenueChange !== null && `(${overview.revenueChange >= 0 ? '+' : ''}${overview.revenueChange.toFixed(1)}%)`}</span>
            </div>
            <div className="kpi-card">
              <strong className="kpi-value">{overview.orderCount}</strong>
              <span className="kpi-label">Đơn hàng {overview.orderChange !== null && `(${overview.orderChange >= 0 ? '+' : ''}${overview.orderChange.toFixed(1)}%)`}</span>
            </div>
            <div className="kpi-card">
              <strong className="kpi-value">{formatCurrency(overview.aov)}</strong>
              <span className="kpi-label">Giá trị đơn TB</span>
            </div>
            <div className="kpi-card">
              <strong className="kpi-value">{formatCurrency(ads?.totals.spent || 0)}</strong>
              <span className="kpi-label">Chi tiêu quảng cáo</span>
            </div>
            <div className="kpi-card">
              <strong className="kpi-value">{(ads?.totals.roas || 0).toFixed(2)}x</strong>
              <span className="kpi-label">ROAS</span>
            </div>
            <div className="kpi-card">
              <strong className="kpi-value">{formatCurrency(ads?.totals.cac || 0)}</strong>
              <span className="kpi-label">CAC</span>
            </div>
          </section>

          <div className="dash-card dash-card-wide" style={{ marginBottom: '24px' }}>
            <div className="dash-card-head">
              <h3>Xu hướng doanh thu / đơn hàng</h3>
              <div className="metric-toggle">
                <button className={`metric-btn ${metric === 'revenue' ? 'metric-btn-active' : ''}`} onClick={() => setMetric('revenue')}>Doanh thu</button>
                <button className={`metric-btn ${metric === 'orders' ? 'metric-btn-active' : ''}`} onClick={() => setMetric('orders')}>Đơn hàng</button>
              </div>
            </div>
            <Chart options={chartOptions} series={chartSeries} type="area" height={280} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
            <div className="dash-card">
              <h3 className="form-card-title">Conversion Funnel</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                {funnel?.stages.map((s, i) => (
                  <div key={s.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span>{s.label}</span>
                      <span><strong>{s.count}</strong> {i > 0 && <span style={{ color: 'var(--dash-muted)' }}>({s.rateFromPrev.toFixed(0)}% từ bước trước)</span>}</span>
                    </div>
                    <div style={{ background: 'var(--dash-border)', height: '18px' }}>
                      <div style={{ background: 'var(--dash-primary)', height: '100%', width: `${(s.count / maxFunnel) * 100}%`, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="dash-card">
              <h3 className="form-card-title">AI Insights</h3>
              {insights.length === 0 ? (
                <p className="dash-empty-state">Chưa có nhận định.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {insights.map((ins, i) => (
                    <div key={i} style={{ fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <span>{INSIGHT_ICON[ins.type] || 'ℹ️'}</span>
                      <span>{ins.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="dash-card dash-card-wide">
            <h3 className="form-card-title">Attribution theo chiến dịch</h3>
            {!ads || ads.rows.length === 0 ? (
              <p className="dash-empty-state">Chưa có chiến dịch nào.</p>
            ) : (
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Chiến dịch</th>
                    <th>Nền tảng</th>
                    <th>Chi tiêu</th>
                    <th>Đơn hàng</th>
                    <th>Doanh thu</th>
                    <th>ROAS</th>
                    <th>CPA</th>
                    <th>CAC</th>
                  </tr>
                </thead>
                <tbody>
                  {ads.rows.map((r) => (
                    <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/dashboard/campaigns/${r.id}`)}>
                      <td><a href="#" onClick={(e) => e.preventDefault()}>{r.name}</a></td>
                      <td><span className={`order-status-badge ${AD_PLATFORM[r.platform]?.cls || ''}`}>{platformLabel(r.platform)}</span></td>
                      <td>{formatCurrency(r.spent)}</td>
                      <td>{r.orders}</td>
                      <td>{formatCurrency(r.revenue)}</td>
                      <td>{r.roas.toFixed(2)}x</td>
                      <td>{formatCurrency(r.cpa)}</td>
                      <td>{formatCurrency(r.cac)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </AdminLayout>
  )
}
