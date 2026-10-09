'use client'

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from '@/lib/router'
import AdminLayout from '../../components/dashboard/AdminLayout'
import { api } from '../../api'
import { ORDER_STATUS, PAYMENT_STATUS, orderStatusLabel, paymentStatusLabel } from '../../constants/orderStatus'
import { formatCurrency, formatDate } from '../../utils/format'

const PAGE_SIZE = 10

export default function OrderList() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(searchParams.get('status') || '')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const [data, setData] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (status) params.set('status', status)
      if (paymentStatus) params.set('paymentStatus', paymentStatus)
      if (paymentMethod) params.set('paymentMethod', paymentMethod)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      params.set('page', String(page))
      params.set('pageSize', String(PAGE_SIZE))

      const res = await api.get(`/orders?${params.toString()}`)
      setData(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [search, status, paymentStatus, paymentMethod, dateFrom, dateTo, page])

  useEffect(() => {
    load()
  }, [load])

  function handleExport() {
    const rows = data.items.map((o) => ({
      'Mã đơn': o.orderNumber,
      'Khách hàng': o.customer?.name,
      'Tổng tiền': o.total,
      'Thanh toán': paymentStatusLabel(o.paymentStatus),
      'Trạng thái': orderStatusLabel(o.status),
      'Vận chuyển': o.shipment?.carrier?.name || '—',
      'Ngày đặt': formatDate(o.createdAt),
    }))
    const header = Object.keys(rows[0] || {}).join(',')
    const body = rows.map((r) => Object.values(r).join(',')).join('\n')
    const blob = new Blob([header + '\n' + body], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'don-hang.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.ceil(data.total / PAGE_SIZE)

  return (
    <AdminLayout activeNav="orders" pageTitle="Đơn hàng" headerActions={null}>
      <div className="dash-card-head" style={{ marginBottom: '12px' }}>
        <span className="dash-tag">{data.total} đơn hàng</span>
      </div>

      <div className="dash-toolbar">
        <input
          type="text"
          placeholder="Tìm theo mã đơn / tên khách hàng / SĐT..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="dash-input"
        />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className="dash-select">
          <option value="">Tất cả trạng thái</option>
          {Object.entries(ORDER_STATUS).map(([key, v]) => (
            <option key={key} value={key}>{v.label}</option>
          ))}
        </select>
        <select value={paymentStatus} onChange={(e) => { setPaymentStatus(e.target.value); setPage(1) }} className="dash-select">
          <option value="">Tất cả thanh toán</option>
          {Object.entries(PAYMENT_STATUS).map(([key, v]) => (
            <option key={key} value={key}>{v.label}</option>
          ))}
        </select>
        <select value={paymentMethod} onChange={(e) => { setPaymentMethod(e.target.value); setPage(1) }} className="dash-select">
          <option value="">Phương thức TT</option>
          <option value="COD">COD</option>
          <option value="Chuyển khoản">Chuyển khoản</option>
        </select>
        <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} className="dash-input" />
        <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} className="dash-input" />
        <button className="dash-btn" onClick={handleExport} disabled={data.items.length === 0}>
          Export
        </button>
      </div>

      {error && <div className="dash-card" style={{ padding: '16px', color: 'var(--discount-red, #d14343)' }}>{error}</div>}

      {loading ? (
        <div className="dash-card" style={{ textAlign: 'center', padding: '40px' }}>
          <p className="dash-empty-state">Đang tải...</p>
        </div>
      ) : data.items.length === 0 ? (
        <div className="dash-card" style={{ textAlign: 'center', padding: '40px' }}>
          <p className="dash-empty-state">Không tìm thấy đơn hàng nào.</p>
        </div>
      ) : (
        <>
          <div className="dash-card dash-card-wide">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Khách hàng</th>
                  <th>Sản phẩm</th>
                  <th>Tổng tiền</th>
                  <th>Thanh toán</th>
                  <th>Trạng thái</th>
                  <th>Vận chuyển</th>
                  <th>Ngày đặt</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/dashboard/orders/${o.id}`) }}>
                        {o.orderNumber}
                      </a>
                    </td>
                    <td>{o.customer?.name}</td>
                    <td>{o.items?.length || 0} sản phẩm</td>
                    <td>{formatCurrency(o.total)}</td>
                    <td>
                      <span className={`order-status-badge ${PAYMENT_STATUS[o.paymentStatus]?.cls || ''}`}>
                        {paymentStatusLabel(o.paymentStatus)}
                      </span>
                    </td>
                    <td>
                      <span className={`order-status-badge ${ORDER_STATUS[o.status]?.cls || ''}`}>
                        {orderStatusLabel(o.status)}
                      </span>
                    </td>
                    <td>{o.shipment?.carrier?.name || '—'}</td>
                    <td>{formatDate(o.createdAt)}</td>
                    <td>
                      <div className="dash-row-actions">
                        <button onClick={() => navigate(`/dashboard/orders/${o.id}`)}>Xem chi tiết</button>
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
                <button
                  key={p}
                  className={`page-btn ${page === p ? 'page-btn-active' : ''}`}
                  onClick={() => setPage(p)}
                >
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
