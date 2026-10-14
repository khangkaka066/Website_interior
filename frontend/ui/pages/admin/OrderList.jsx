'use client'

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from '@/lib/router'
import AdminLayout from '../../components/dashboard/AdminLayout'
import { api } from '../../api'
import PrintOrdersModal from '../../components/dashboard/orders/PrintOrdersModal'
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
  const [printIds, setPrintIds] = useState(null) // mở khung xem trước phiếu in khi có giá trị
  const [selected, setSelected] = useState(() => new Set()) // id các đơn được chọn để in (giữ khi sang trang khác)

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
      'Mã vận đơn': o.shipment?.status !== 'NOT_CREATED' ? o.shipment?.carrierCode || '' : '',
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

  const toggleOne = (id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const pageIds = data.items.map((o) => o.id)
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id))
  const toggleAll = () => setSelected((s) => { const n = new Set(s); pageIds.forEach((id) => (allOnPage ? n.delete(id) : n.add(id))); return n })
  // In các đơn đã chọn; chưa chọn đơn nào thì in các đơn đang hiện trên trang này.
  function handlePrint() {
    setPrintIds(selected.size ? [...selected] : pageIds)
  }

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
        <button className="dash-btn" onClick={handlePrint} disabled={data.items.length === 0} title="Tích chọn các đơn rồi in; không chọn thì in các đơn đang hiện">
          {selected.size ? `In ${selected.size} đơn đã chọn` : 'In đơn'}
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
                  <th style={{ width: '32px' }}>
                    <input type="checkbox" checked={allOnPage} onChange={toggleAll} aria-label="Chọn tất cả đơn trên trang" />
                  </th>
                  <th>Mã đơn</th>
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
                      <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleOne(o.id)} aria-label={`Chọn đơn ${o.orderNumber}`} />
                    </td>
                    <td>
                      <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/dashboard/orders/${o.id}`) }}>
                        {o.code || o.orderNumber}
                      </a>
                      {o.code && o.code !== o.orderNumber && <div style={{ fontSize: '11px', color: 'var(--dash-muted)' }}>{o.orderNumber}</div>}
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

      {printIds && <PrintOrdersModal ids={printIds} onClose={() => setPrintIds(null)} />}
    </AdminLayout>
  )
}
