'use client'

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from '@/lib/router'
import AdminLayout from '../../components/dashboard/AdminLayout'
import { api } from '../../api'
import { SHIPPING_STATUS, shippingStatusLabel } from '../../constants/shippingStatus'
import { formatCurrency, formatDate } from '../../utils/format'

const PAGE_SIZE = 10

export default function ShippingDashboard() {
  const navigate = useNavigate()
  const [kpi, setKpi] = useState(null)
  const [alerts, setAlerts] = useState([])

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [carrierId, setCarrierId] = useState('')
  const [carriers, setCarriers] = useState([])
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/shipping/dashboard').then(setKpi).catch(() => {})
    api.get('/shipping/alerts').then((r) => setAlerts(r.alerts)).catch(() => {})
    api.get('/shipping/carriers').then(setCarriers).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (status) params.set('status', status)
      if (carrierId) params.set('carrierId', carrierId)
      params.set('page', String(page))
      params.set('pageSize', String(PAGE_SIZE))
      const res = await api.get(`/shipping?${params.toString()}`)
      setData(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [search, status, carrierId, page])

  useEffect(() => {
    load()
  }, [load])

  function handleAlertClick(alert) {
    if (alert.filter?.status) {
      if (Object.keys(SHIPPING_STATUS).includes(alert.filter.status)) {
        setStatus(alert.filter.status)
      } else {
        // "AWAITING_SHIPMENT" alert refers to orders without a shipment yet —
        // send admin to the order list instead of the shipment list.
        navigate(`/dashboard/orders?status=${alert.filter.status}`)
        return
      }
    }
    setPage(1)
  }

  const totalPages = Math.ceil(data.total / PAGE_SIZE)

  const kpiItems = kpi
    ? [
        { label: 'Chờ giao hàng', value: kpi.awaitingShipment },
        { label: 'Đang giao', value: kpi.inTransit },
        { label: 'Đã giao hôm nay', value: kpi.deliveredToday },
        { label: 'Giao thất bại', value: kpi.failed },
        { label: 'Đang hoàn hàng', value: kpi.returning },
        { label: 'Thời gian giao TB', value: `${kpi.avgDeliveryDays} ngày` },
        { label: 'Tỷ lệ giao thành công', value: `${kpi.successRate}%` },
      ]
    : []

  return (
    <AdminLayout activeNav="shipping" pageTitle="Vận chuyển">
      {kpi && (
        <section className="kpi-grid" style={{ marginBottom: '20px' }}>
          {kpiItems.map((item) => (
            <div className="kpi-card" key={item.label}>
              <strong className="kpi-value">{item.value}</strong>
              <span className="kpi-label">{item.label}</span>
            </div>
          ))}
        </section>
      )}

      {alerts.length > 0 && (
        <div className="shipping-alerts">
          {alerts.map((a) => (
            <button key={a.key} className="shipping-alert" onClick={() => handleAlertClick(a)}>
              ⚠ {a.message}
            </button>
          ))}
        </div>
      )}

      <div className="dash-toolbar">
        <input
          type="text"
          placeholder="Tìm theo mã vận đơn / mã đơn / người nhận..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="dash-input"
        />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className="dash-select">
          <option value="">Tất cả trạng thái</option>
          {Object.entries(SHIPPING_STATUS).map(([key, v]) => (
            <option key={key} value={key}>{v.label}</option>
          ))}
        </select>
        <select value={carrierId} onChange={(e) => { setCarrierId(e.target.value); setPage(1) }} className="dash-select">
          <option value="">Tất cả đơn vị vận chuyển</option>
          {carriers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button className="dash-btn dash-btn-ghost" onClick={() => navigate('/dashboard/shipping/carriers')}>
          Đơn vị vận chuyển
        </button>
      </div>

      {error && <div className="dash-card" style={{ padding: '16px', color: 'var(--dash-danger)' }}>{error}</div>}

      {loading ? (
        <div className="dash-card" style={{ textAlign: 'center', padding: '40px' }}>Đang tải...</div>
      ) : data.items.length === 0 ? (
        <div className="dash-card" style={{ textAlign: 'center', padding: '40px' }}>
          <p className="dash-empty-state">Không tìm thấy vận đơn nào.</p>
        </div>
      ) : (
        <>
          <div className="dash-card dash-card-wide">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Tracking ID</th>
                  <th>Order ID</th>
                  <th>Người nhận</th>
                  <th>Đơn vị vận chuyển</th>
                  <th>COD</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th>Cập nhật cuối</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/dashboard/shipping/${s.id}`) }}>
                        {s.trackingId}
                      </a>
                    </td>
                    <td>{s.order?.orderNumber}</td>
                    <td>{s.recipientName}</td>
                    <td>{s.carrier?.name}</td>
                    <td>{s.codAmount ? formatCurrency(s.codAmount) : '—'}</td>
                    <td>
                      <span className={`order-status-badge ${SHIPPING_STATUS[s.status]?.cls || ''}`}>
                        {shippingStatusLabel(s.status)}
                      </span>
                    </td>
                    <td>{formatDate(s.createdAt)}</td>
                    <td>{formatDate(s.updatedAt)}</td>
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
    </AdminLayout>
  )
}
