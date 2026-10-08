'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from '@/lib/router'
import Chart from 'react-apexcharts'
import AdminLayout from '../../components/dashboard/AdminLayout'
import ConfirmModal from '../../components/dashboard/ConfirmModal'
import CustomerFormModal from '../../components/dashboard/customers/CustomerFormModal'
import { api } from '../../api'
import { CUSTOMER_STATUS, CUSTOMER_SEGMENT, customerStatusLabel, customerSegmentLabel } from '../../constants/customer'
import { ORDER_STATUS, PAYMENT_STATUS, orderStatusLabel, paymentStatusLabel } from '../../constants/orderStatus'
import { SHIPPING_STATUS, shippingStatusLabel } from '../../constants/shippingStatus'
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format'

const METRICS = [
  { id: 'revenue', label: 'Doanh thu' },
  { id: 'orders', label: 'Số đơn hàng' },
  { id: 'aov', label: 'AOV' },
]

const HISTORY_FILTERS = [
  { id: '', label: 'Tất cả' },
  { id: 'DELIVERED', label: 'Đã giao' },
  { id: 'PROCESSING', label: 'Đang xử lý' },
  { id: 'CANCELLED', label: 'Đã hủy' },
  { id: 'RETURNED', label: 'Đã trả hàng' },
]

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null) // 'block' | 'unblock' | 'edit'
  const [metric, setMetric] = useState('revenue')
  const [historyFilter, setHistoryFilter] = useState('')
  const [newTag, setNewTag] = useState('')
  const [newNote, setNewNote] = useState('')
  const [addingAddress, setAddingAddress] = useState(false)
  const [addrForm, setAddrForm] = useState({ recipientName: '', phone: '', addressLine: '', ward: '', district: '', province: '', isDefault: false })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get(`/customers/${id}`)
      setCustomer(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function handleSetStatus(status) {
    await api.post(`/customers/${id}/status`, { status })
    setModal(null)
    await load()
  }

  async function handleAddTag() {
    if (!newTag.trim()) return
    const tags = [...new Set([...(customer.tags || []), newTag.trim()])]
    await api.patch(`/customers/${id}`, { tags })
    setNewTag('')
    await load()
  }

  async function handleRemoveTag(tag) {
    const tags = (customer.tags || []).filter((t) => t !== tag)
    await api.patch(`/customers/${id}`, { tags })
    await load()
  }

  async function handleAddNote() {
    if (!newNote.trim()) return
    await api.post(`/customers/${id}/notes`, { content: newNote.trim() })
    setNewNote('')
    await load()
  }

  async function handleAddAddress() {
    await api.post(`/customers/${id}/addresses`, addrForm)
    setAddingAddress(false)
    setAddrForm({ recipientName: '', phone: '', addressLine: '', ward: '', district: '', province: '', isDefault: false })
    await load()
  }

  async function handleDeleteAddress(addressId) {
    if (!window.confirm('Xóa địa chỉ này?')) return
    await api.delete(`/customers/${id}/addresses/${addressId}`)
    await load()
  }

  function handleNotify() {
    window.alert(`Đã gửi thông báo tới ${customer.name} (${customer.email || customer.phone}).\n\nLưu ý: đây là bản demo, chưa nối hệ thống gửi email/SMS thật.`)
  }

  if (loading) {
    return (
      <AdminLayout activeNav="customers" pageTitle="Khách hàng">
        <div className="dash-card" style={{ textAlign: 'center', padding: '40px' }}>Đang tải...</div>
      </AdminLayout>
    )
  }

  if (error || !customer) {
    return (
      <AdminLayout activeNav="customers" pageTitle="Lỗi">
        <div className="dash-card" style={{ textAlign: 'center', padding: '40px' }}>
          <p>{error || 'Không tìm thấy khách hàng.'}</p>
          <button className="dash-btn" onClick={() => navigate('/dashboard/customers')}>Quay lại danh sách</button>
        </div>
      </AdminLayout>
    )
  }

  const filteredOrders = historyFilter ? customer.orders.filter((o) => o.status === historyFilter) : customer.orders

  const chartOptions = {
    chart: { type: 'area', toolbar: { show: false } },
    colors: ['#b5602f'],
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 3 },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.28, opacityTo: 0, stops: [0, 90, 100] } },
    grid: { borderColor: '#ece0d6' },
    legend: { show: false },
    xaxis: {
      categories: customer.spendingByMonth.map((m) => m.label),
      labels: { style: { colors: '#a89685' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { style: { colors: '#a89685' } } },
    tooltip: { theme: 'light' },
  }
  const chartSeries = [{ name: METRICS.find((m) => m.id === metric).label, data: customer.spendingByMonth.map((m) => m[metric]) }]

  return (
    <AdminLayout activeNav="customers" pageTitle={customer.name}>
      <a className="detail-back-link" href="#" onClick={(e) => { e.preventDefault(); navigate('/dashboard/customers') }}>
        ← Quay lại danh sách khách hàng
      </a>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <div style={{ width: '48px', height: '48px', background: 'var(--dash-active-bg)', color: 'var(--dash-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px' }}>
            {customer.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--dash-heading)' }}>{customer.name}</h2>
              <span className={`order-status-badge ${CUSTOMER_SEGMENT[customer.segment]?.cls || ''}`}>{customerSegmentLabel(customer.segment)}</span>
              <span className={`order-status-badge ${CUSTOMER_STATUS[customer.status]?.cls || ''}`}>{customerStatusLabel(customer.status)}</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--dash-muted)' }}>{customer.email || '—'} · {customer.phone}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="dash-btn dash-btn-ghost" onClick={() => setModal('edit')}>Chỉnh sửa</button>
          <button className="dash-btn dash-btn-ghost" onClick={handleNotify}>Gửi thông báo</button>
          {customer.status === 'BLOCKED' ? (
            <button className="dash-btn dash-btn-ghost" onClick={() => setModal('unblock')}>Mở khóa tài khoản</button>
          ) : (
            <button className="dash-btn dash-btn-ghost" onClick={() => setModal('block')}>Khóa tài khoản</button>
          )}
        </div>
      </div>

      <section className="kpi-grid" style={{ marginBottom: '24px' }}>
        {[
          { label: 'Tổng đơn hàng', value: customer.orderCount },
          { label: 'Tổng chi tiêu', value: formatCurrency(customer.totalSpent) },
          { label: 'AOV', value: formatCurrency(customer.aov) },
          { label: 'Lần mua gần nhất', value: formatDate(customer.lastOrderAt) },
          { label: 'Giá trị khách hàng (LTV)', value: formatCurrency(customer.totalSpent) },
          { label: 'Tỷ lệ mua lại', value: `${customer.repeatRate.toFixed(0)}%` },
        ].map((item) => (
          <div className="kpi-card" key={item.label}>
            <strong className="kpi-value">{item.value}</strong>
            <span className="kpi-label">{item.label}</span>
          </div>
        ))}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div className="dash-card">
          <h3 className="form-card-title">Hồ sơ khách hàng</h3>
          <div style={{ fontSize: '13px', lineHeight: '1.9' }}>
            <div><strong>Họ tên:</strong> {customer.name}</div>
            <div><strong>Email:</strong> {customer.email || '—'}</div>
            <div><strong>SĐT:</strong> {customer.phone}</div>
            <div><strong>Ngày sinh:</strong> {customer.dob ? formatDate(customer.dob) : '—'}</div>
            <div><strong>Giới tính:</strong> {customer.gender === 'male' ? 'Nam' : customer.gender === 'female' ? 'Nữ' : customer.gender || '—'}</div>
            <div><strong>Ngày đăng ký:</strong> {formatDate(customer.createdAt)}</div>
            <div><strong>Hoạt động gần nhất:</strong> {customer.lastOrderAt ? formatDate(customer.lastOrderAt) : '—'}</div>
          </div>

          <div style={{ marginTop: '14px' }}>
            <strong style={{ fontSize: '12px', color: 'var(--dash-heading)' }}>Tags</strong>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px', marginBottom: '8px' }}>
              {(customer.tags || []).length === 0 && <span className="dash-empty-state" style={{ fontSize: '12px' }}>Chưa có tag</span>}
              {(customer.tags || []).map((tag) => (
                <span key={tag} className="order-status-badge status-processing" style={{ cursor: 'pointer' }} onClick={() => handleRemoveTag(tag)}>
                  {tag} ✕
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input className="dash-input" style={{ flex: 1 }} value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Thêm tag mới..." />
              <button className="dash-btn dash-btn-ghost" onClick={handleAddTag}>Thêm</button>
            </div>
          </div>
        </div>

        <div className="dash-card">
          <div className="dash-card-head">
            <h3 className="form-card-title" style={{ marginBottom: 0 }}>Địa chỉ</h3>
            <button className="dash-btn dash-btn-ghost" onClick={() => setAddingAddress((v) => !v)}>
              {addingAddress ? 'Đóng' : '+ Thêm địa chỉ'}
            </button>
          </div>

          {addingAddress && (
            <div className="dash-form-grid" style={{ marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid var(--dash-border)' }}>
              <div className="dash-form-field">
                <label>Người nhận</label>
                <input value={addrForm.recipientName} onChange={(e) => setAddrForm((f) => ({ ...f, recipientName: e.target.value }))} />
              </div>
              <div className="dash-form-field">
                <label>SĐT</label>
                <input value={addrForm.phone} onChange={(e) => setAddrForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="dash-form-field full">
                <label>Địa chỉ</label>
                <input value={addrForm.addressLine} onChange={(e) => setAddrForm((f) => ({ ...f, addressLine: e.target.value }))} />
              </div>
              <div className="dash-form-field">
                <label>Phường/Xã</label>
                <input value={addrForm.ward} onChange={(e) => setAddrForm((f) => ({ ...f, ward: e.target.value }))} />
              </div>
              <div className="dash-form-field">
                <label>Quận/Huyện</label>
                <input value={addrForm.district} onChange={(e) => setAddrForm((f) => ({ ...f, district: e.target.value }))} />
              </div>
              <div className="dash-form-field">
                <label>Tỉnh/Thành phố</label>
                <input value={addrForm.province} onChange={(e) => setAddrForm((f) => ({ ...f, province: e.target.value }))} />
              </div>
              <div className="dash-form-field full" style={{ flexDirection: 'row', alignItems: 'center', gap: '6px' }}>
                <input type="checkbox" checked={addrForm.isDefault} onChange={(e) => setAddrForm((f) => ({ ...f, isDefault: e.target.checked }))} style={{ width: 'auto' }} />
                <label style={{ margin: 0 }}>Đặt làm địa chỉ mặc định</label>
              </div>
              <div className="dash-form-field full" style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <button className="dash-btn" onClick={handleAddAddress}>Lưu địa chỉ</button>
              </div>
            </div>
          )}

          {customer.addresses.length === 0 ? (
            <p className="dash-empty-state">Chưa có địa chỉ nào.</p>
          ) : (
            customer.addresses.map((addr) => (
              <div key={addr.id} style={{ fontSize: '13px', paddingBottom: '10px', marginBottom: '10px', borderBottom: '1px solid var(--dash-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{addr.recipientName} {addr.isDefault && <span className="order-status-badge status-delivered">Mặc định</span>}</strong>
                  <button className="dash-btn dash-btn-ghost" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => handleDeleteAddress(addr.id)}>Xóa</button>
                </div>
                <div>{addr.phone}</div>
                <div>{[addr.addressLine, addr.ward, addr.district, addr.province].filter(Boolean).join(', ')}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="dash-card dash-card-wide" style={{ marginBottom: '24px' }}>
        <div className="dash-card-head">
          <h3>Chi tiêu theo thời gian</h3>
          <div className="metric-toggle">
            {METRICS.map((m) => (
              <button key={m.id} className={`metric-btn ${metric === m.id ? 'metric-btn-active' : ''}`} onClick={() => setMetric(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <Chart options={chartOptions} series={chartSeries} type="area" height={260} />
      </div>

      <div className="dash-card dash-card-wide" style={{ marginBottom: '24px' }}>
        <div className="dash-card-head">
          <h3>Lịch sử mua hàng</h3>
        </div>
        <div className="dash-toolbar" style={{ padding: 0, border: 'none', marginBottom: '12px' }}>
          {HISTORY_FILTERS.map((f) => (
            <button
              key={f.id}
              className={`dash-btn dash-btn-ghost ${historyFilter === f.id ? 'page-btn-active' : ''}`}
              onClick={() => setHistoryFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        {filteredOrders.length === 0 ? (
          <p className="dash-empty-state">Không có đơn hàng nào.</p>
        ) : (
          <table className="dash-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Ngày đặt</th>
                <th>Sản phẩm</th>
                <th>Tổng tiền</th>
                <th>Thanh toán</th>
                <th>Trạng thái</th>
                <th>Vận chuyển</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/dashboard/orders/${o.id}`) }}>{o.orderNumber}</a>
                  </td>
                  <td>{formatDate(o.createdAt)}</td>
                  <td>{o.items.length} sản phẩm</td>
                  <td>{formatCurrency(o.total)}</td>
                  <td><span className={`order-status-badge ${PAYMENT_STATUS[o.paymentStatus]?.cls || ''}`}>{paymentStatusLabel(o.paymentStatus)}</span></td>
                  <td><span className={`order-status-badge ${ORDER_STATUS[o.status]?.cls || ''}`}>{orderStatusLabel(o.status)}</span></td>
                  <td>{o.shipment ? <span className={`order-status-badge ${SHIPPING_STATUS[o.shipment.status]?.cls || ''}`}>{shippingStatusLabel(o.shipment.status)}</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div className="dash-card">
          <h3 className="form-card-title">Hoạt động của khách hàng</h3>
          <div className="step-timeline">
            {customer.timeline.map((ev, idx) => (
              <div key={idx} className={`step-timeline-item ${idx < customer.timeline.length - 1 ? 'completed' : 'current'}`}>
                <div className="step-timeline-dot" />
                <div className="step-timeline-line" />
                <div className="step-timeline-content">
                  <div className="step-timeline-label">{ev.event}</div>
                  <div className="step-timeline-time">{formatDateTime(ev.timestamp)}</div>
                  {ev.orderNumber && (
                    <div className="step-timeline-note">
                      <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/dashboard/orders/${ev.orderId}`) }}>{ev.orderNumber}</a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="dash-card">
          <h3 className="form-card-title">Ghi chú nội bộ</h3>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            <textarea className="dash-input" style={{ flex: 1 }} value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Thêm ghi chú (chỉ admin thấy)..." />
          </div>
          <button className="dash-btn dash-btn-ghost" style={{ marginBottom: '14px' }} onClick={handleAddNote}>Lưu ghi chú</button>
          {customer.notes.length === 0 ? (
            <p className="dash-empty-state">Chưa có ghi chú nào.</p>
          ) : (
            customer.notes.map((n) => (
              <div key={n.id} style={{ fontSize: '13px', paddingBottom: '10px', marginBottom: '10px', borderBottom: '1px solid var(--dash-border)' }}>
                <div>{n.content}</div>
                <div style={{ fontSize: '11px', color: 'var(--dash-muted)' }}>{formatDateTime(n.createdAt)} · {n.author}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {modal === 'block' && (
        <ConfirmModal
          title="Khóa tài khoản"
          message={`Xác nhận khóa tài khoản của ${customer.name}? Khách hàng sẽ không thể đăng nhập.`}
          confirmLabel="Khóa tài khoản"
          onConfirm={() => handleSetStatus('BLOCKED')}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'unblock' && (
        <ConfirmModal
          title="Mở khóa tài khoản"
          message={`Xác nhận mở khóa tài khoản của ${customer.name}?`}
          confirmLabel="Mở khóa"
          onConfirm={() => handleSetStatus('ACTIVE')}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'edit' && (
        <CustomerFormModal
          customer={customer}
          onClose={() => setModal(null)}
          onUpdated={() => { setModal(null); load() }}
        />
      )}
    </AdminLayout>
  )
}
