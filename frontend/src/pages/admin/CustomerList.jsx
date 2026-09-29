import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Chart from 'react-apexcharts'
import AdminLayout from '../../components/dashboard/AdminLayout'
import CustomerFormModal from '../../components/dashboard/customers/CustomerFormModal'
import { api } from '../../api'
import { CUSTOMER_STATUS, CUSTOMER_SEGMENT, customerStatusLabel, customerSegmentLabel } from '../../constants/customer'
import { formatCurrency, formatDate } from '../../utils/format'

const PAGE_SIZE = 10
const RANGES = [
  { id: 'today', label: 'Hôm nay' },
  { id: '7d', label: '7 ngày' },
  { id: '30d', label: '30 ngày' },
  { id: 'month', label: 'Tháng này' },
]

export default function CustomerList() {
  const navigate = useNavigate()
  const [range, setRange] = useState('30d')
  const [overview, setOverview] = useState(null)

  const [search, setSearch] = useState('')
  const [segment, setSegment] = useState('')
  const [status, setStatus] = useState('')
  const [sortBy, setSortBy] = useState('latest')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    api.get(`/customers/overview?range=${range}`).then(setOverview).catch(() => {})
  }, [range])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (segment) params.set('segment', segment)
      if (status) params.set('status', status)
      params.set('sortBy', sortBy)
      params.set('page', String(page))
      params.set('pageSize', String(PAGE_SIZE))
      const res = await api.get(`/customers?${params.toString()}`)
      setData(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [search, segment, status, sortBy, page])

  useEffect(() => {
    load()
  }, [load])

  const totalPages = Math.ceil(data.total / PAGE_SIZE)

  const kpiItems = overview
    ? [
        { label: 'Tổng khách hàng', value: overview.totalCustomers },
        { label: 'Khách hàng mới', value: overview.newCustomers },
        { label: 'Đang hoạt động', value: overview.activeCustomers },
        { label: 'Khách quay lại', value: overview.returningCustomers },
        { label: 'Khách VIP', value: overview.vipCustomers },
        { label: 'Giá trị đơn TB', value: formatCurrency(overview.avgOrderValue) },
        { label: 'Tổng doanh thu', value: formatCurrency(overview.totalRevenue) },
      ]
    : []

  const chartOptions = {
    chart: { type: 'bar', toolbar: { show: false }, stacked: false },
    colors: ['#b5602f', '#3aa0c9'],
    plotOptions: { bar: { columnWidth: '55%', borderRadius: 0 } },
    dataLabels: { enabled: false },
    grid: { borderColor: '#ece0d6' },
    legend: { show: true, labels: { colors: '#7a6f68' }, markers: { radius: 4 } },
    xaxis: {
      categories: overview?.newVsReturning?.map((m) => m.label) || [],
      labels: { style: { colors: '#a89685' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { style: { colors: '#a89685' } } },
    tooltip: { theme: 'light' },
  }
  const chartSeries = [
    { name: 'Khách mới', data: overview?.newVsReturning?.map((m) => m.new) || [] },
    { name: 'Khách quay lại', data: overview?.newVsReturning?.map((m) => m.returning) || [] },
  ]

  return (
    <AdminLayout activeNav="customers" pageTitle="Khách hàng" headerActions={
      <button className="dash-btn" onClick={() => setShowAddModal(true)}>+ Thêm khách hàng</button>
    }>
      <div className="dash-toolbar" style={{ justifyContent: 'flex-end', marginBottom: '12px' }}>
        {RANGES.map((r) => (
          <button
            key={r.id}
            className={`dash-btn dash-btn-ghost ${range === r.id ? 'page-btn-active' : ''}`}
            onClick={() => setRange(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {overview && (
        <section className="kpi-grid" style={{ marginBottom: '20px' }}>
          {kpiItems.map((item) => (
            <div className="kpi-card" key={item.label}>
              <strong className="kpi-value">{item.value}</strong>
              <span className="kpi-label">{item.label}</span>
            </div>
          ))}
        </section>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div className="dash-card dash-card-wide">
          <div className="dash-card-head">
            <h3>Khách hàng mới so với khách quay lại</h3>
          </div>
          <Chart options={chartOptions} series={chartSeries} type="bar" height={260} />
        </div>

        <div className="dash-card dash-card-wide">
          <div className="dash-card-head">
            <h3>Phân nhóm khách hàng</h3>
          </div>
          <table className="dash-table">
            <thead>
              <tr>
                <th>Nhóm</th>
                <th>SL</th>
                <th>Doanh thu</th>
                <th>AOV</th>
              </tr>
            </thead>
            <tbody>
              {overview?.segmentSummary.filter((s) => s.customers > 0).map((s) => (
                <tr key={s.segment}>
                  <td><span className={`order-status-badge ${CUSTOMER_SEGMENT[s.segment]?.cls || ''}`}>{customerSegmentLabel(s.segment)}</span></td>
                  <td>{s.customers}</td>
                  <td>{formatCurrency(s.revenue)}</td>
                  <td>{formatCurrency(s.aov)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dash-toolbar">
        <input
          type="text"
          placeholder="Tìm theo tên / email / SĐT..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="dash-input"
        />
        <select value={segment} onChange={(e) => { setSegment(e.target.value); setPage(1) }} className="dash-select">
          <option value="">Tất cả nhóm</option>
          {Object.entries(CUSTOMER_SEGMENT).map(([key, v]) => (
            <option key={key} value={key}>{v.label}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className="dash-select">
          <option value="">Tất cả trạng thái</option>
          {Object.entries(CUSTOMER_STATUS).map(([key, v]) => (
            <option key={key} value={key}>{v.label}</option>
          ))}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="dash-select">
          <option value="latest">Mới nhất</option>
          <option value="spending">Chi tiêu cao nhất</option>
          <option value="orders">Nhiều đơn hàng nhất</option>
          <option value="activity">Hoạt động gần đây</option>
        </select>
      </div>

      {error && <div className="dash-card" style={{ padding: '16px', color: 'var(--dash-danger)' }}>{error}</div>}

      {loading ? (
        <div className="dash-card" style={{ textAlign: 'center', padding: '40px' }}>Đang tải...</div>
      ) : data.items.length === 0 ? (
        <div className="dash-card" style={{ textAlign: 'center', padding: '40px' }}>
          <p className="dash-empty-state">Không tìm thấy khách hàng nào.</p>
        </div>
      ) : (
        <>
          <div className="dash-card dash-card-wide">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Khách hàng</th>
                  <th>Email</th>
                  <th>SĐT</th>
                  <th>Đơn hàng</th>
                  <th>Tổng chi tiêu</th>
                  <th>Đơn gần nhất</th>
                  <th>Nhóm</th>
                  <th>Trạng thái</th>
                  <th>Ngày đăng ký</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/dashboard/customers/${c.id}`) }}>
                        {c.name}
                      </a>
                    </td>
                    <td>{c.email || '—'}</td>
                    <td>{c.phone}</td>
                    <td>{c.orderCount}</td>
                    <td>{formatCurrency(c.totalSpent)}</td>
                    <td>{formatDate(c.lastOrderAt)}</td>
                    <td><span className={`order-status-badge ${CUSTOMER_SEGMENT[c.segment]?.cls || ''}`}>{customerSegmentLabel(c.segment)}</span></td>
                    <td><span className={`order-status-badge ${CUSTOMER_STATUS[c.status]?.cls || ''}`}>{customerStatusLabel(c.status)}</span></td>
                    <td>{formatDate(c.createdAt)}</td>
                    <td>
                      <div className="dash-row-actions">
                        <button onClick={() => navigate(`/dashboard/customers/${c.id}`)}>Xem chi tiết</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} className={`page-btn ${page === p ? 'page-btn-active' : ''}`} onClick={() => setPage(p)}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {showAddModal && (
        <CustomerFormModal
          onClose={() => setShowAddModal(false)}
          onCreated={(customer) => {
            setShowAddModal(false)
            navigate(`/dashboard/customers/${customer.id}`)
          }}
        />
      )}
    </AdminLayout>
  )
}
