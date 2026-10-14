'use client'

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from '@/lib/router'
import AdminLayout from '../../components/dashboard/AdminLayout'
import { api } from '../../api'
import PrintOrdersModal from '../../components/dashboard/orders/PrintOrdersModal'
import { ORDER_STATUS, PAYMENT_STATUS, orderStatusLabel, paymentStatusLabel } from '../../constants/orderStatus'
import { formatCurrency, formatDate, dueIn } from '../../utils/format'
import ConfirmModal from '../../components/dashboard/ConfirmModal'
import DeliveryBadge, { DELIVERY_LABEL } from '../../components/DeliveryBadge'

const PAGE_SIZE = 10

// Hạn xử lý + huy hiệu yêu cầu của khách (hủy / trả hàng) đang chờ nhân viên phản hồi.
function DueCell({ order }) {
  const due = dueIn(order.handleDueAt)
  const cancelAsk = !!order.cancelRequestedAt
  const returnAsk = order.returnRequest?.status === 'REQUESTED'
  if (!due && !cancelAsk && !returnAsk) return <span>—</span>
  return (
    <div style={{ fontSize: '12px', lineHeight: 1.5 }}>
      {due && <div style={{ color: due.overdue ? 'var(--dash-danger, #c0392b)' : due.soon ? '#b26a00' : 'inherit', fontWeight: due.overdue || due.soon ? 600 : 400 }}>{due.text}</div>}
      {cancelAsk && <span className="order-status-badge status-cancelled">Khách xin hủy</span>}
      {returnAsk && <span className="order-status-badge status-cancelled">Khách xin trả hàng</span>}
    </div>
  )
}

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
  const [deliveryType, setDeliveryType] = useState(searchParams.get('deliveryType') || '')
  const [needsAction, setNeedsAction] = useState(searchParams.get('needsAction') === '1') // chỉ đơn nhân viên còn việc, đơn cũ nhất lên đầu
  const [bulkMsg, setBulkMsg] = useState(null) // { ok, text, failed: [...] } sau khi chạy thao tác hàng loạt
  const [bulkBusy, setBulkBusy] = useState(false)
  const [goshipReady, setGoshipReady] = useState(false)
  const [confirmShip, setConfirmShip] = useState(false)
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
      if (needsAction) params.set('needsAction', '1')
      if (deliveryType) params.set('deliveryType', deliveryType)
      params.set('page', String(page))
      params.set('pageSize', String(PAGE_SIZE))

      const res = await api.get(`/orders?${params.toString()}`)
      setData(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [search, status, paymentStatus, paymentMethod, dateFrom, dateTo, needsAction, deliveryType, page])

  useEffect(() => {
    load()
  }, [load])

  function handleExport() {
    const rows = data.items.map((o) => ({
      'Mã đơn': o.orderNumber,
      'Loại giao hàng': DELIVERY_LABEL[o.deliveryType] || '',
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

  useEffect(() => {
    api.get('/shipping/goship/config').then((c) => setGoshipReady(Boolean(c.ready))).catch(() => setGoshipReady(false))
  }, [])

  // Chạy một thao tác cho các đơn đã chọn; đơn nào lỗi thì liệt kê lý do, đơn nào xong thì bỏ khỏi lựa chọn.
  async function runBulk(label, request) {
    setBulkBusy(true)
    setBulkMsg(null)
    try {
      const { results, done } = await request([...selected])
      const failed = results.filter((r) => !r.ok)
      setSelected(new Set(failed.map((r) => r.id || r.orderId)))
      setBulkMsg({ ok: !failed.length, text: `${label}: thành công ${done}/${results.length} đơn.`, failed })
      await load()
    } catch (err) {
      setBulkMsg({ ok: false, text: err.message, failed: [] })
    } finally {
      setBulkBusy(false)
    }
  }
  const bulkStatus = (status, label) => runBulk(label, (ids) => api.post('/orders/bulk-status', { ids, status }))
  const bulkShip = () => runBulk('Tạo vận đơn Goship', (ids) => api.post('/shipping/goship/bulk-shipments', { orderIds: ids, confirm: true }))

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
        <select value={deliveryType} onChange={(e) => { setDeliveryType(e.target.value); setPage(1) }} className="dash-select">
          <option value="">Mọi loại giao hàng</option>
          {Object.entries(DELIVERY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="dash-check" title="Đơn còn việc phải làm, đơn cũ nhất (gần quá hạn nhất) lên đầu" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
          <input type="checkbox" checked={needsAction} onChange={(e) => { setNeedsAction(e.target.checked); setPage(1) }} /> Cần xử lý
        </label>
        <button className="dash-btn" onClick={handleExport} disabled={data.items.length === 0}>
          Export
        </button>
        <button className="dash-btn" onClick={handlePrint} disabled={data.items.length === 0} title="Tích chọn các đơn rồi in; không chọn thì in các đơn đang hiện">
          {selected.size ? `In ${selected.size} đơn đã chọn` : 'In đơn'}
        </button>
      </div>

      {selected.size > 0 && (
        <div className="dash-card" style={{ padding: '12px 16px', marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '13px' }}>Đã chọn {selected.size} đơn</strong>
          <button className="dash-btn" disabled={bulkBusy} onClick={() => bulkStatus('CONFIRMED', 'Xác nhận đơn')}>Xác nhận đơn</button>
          <button className="dash-btn" disabled={bulkBusy} onClick={() => bulkStatus('PROCESSING', 'Chuẩn bị hàng')}>Chuẩn bị hàng</button>
          {goshipReady && <button className="dash-btn" disabled={bulkBusy} onClick={() => setConfirmShip(true)}>Tạo vận đơn Goship</button>}
          <button className="dash-btn dash-btn-ghost" disabled={bulkBusy} onClick={handlePrint}>In đơn</button>
          <button className="dash-btn dash-btn-ghost" disabled={bulkBusy} onClick={() => setSelected(new Set())}>Bỏ chọn</button>
        </div>
      )}
      {bulkMsg && (
        <div className="dash-card" style={{ padding: '12px 16px', marginBottom: '12px', fontSize: '13px', color: bulkMsg.ok ? 'var(--dash-success, #2e7d32)' : 'var(--dash-danger, #c0392b)' }}>
          {bulkMsg.text}
          {bulkMsg.failed.map((f) => (
            <div key={f.id || f.orderId}>• {f.orderNumber || f.id || f.orderId}: {f.error}</div>
          ))}
        </div>
      )}
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
                  <th>Hạn xử lý</th>
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
                      <DeliveryBadge type={o.deliveryType} />
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
                      <DueCell order={o} />
                    </td>
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

      {confirmShip && (
        <ConfirmModal
          title="Tạo vận đơn Goship hàng loạt"
          message={`Tạo vận đơn THẬT cho ${selected.size} đơn đã chọn. Mỗi đơn lấy phương án có cước rẻ nhất hiện có và phát sinh cước thật trên Goship. Chỉ đơn đang ở "Đang xử lý" hoặc "Chờ giao hàng" mới tạo được.`}
          confirmLabel="Tạo vận đơn"
          onConfirm={async () => { setConfirmShip(false); await bulkShip() }}
          onClose={() => setConfirmShip(false)}
        />
      )}
      {printIds && <PrintOrdersModal ids={printIds} onClose={() => setPrintIds(null)} />}
    </AdminLayout>
  )
}
