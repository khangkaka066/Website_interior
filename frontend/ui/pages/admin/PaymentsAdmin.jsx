'use client'

import { useState, useEffect, useCallback } from 'react'
import { Link } from '@/lib/router'
import AdminLayout from '../../components/dashboard/AdminLayout'
import { api } from '../../api'
import { PAYMENT_STATUS, ORDER_STATUS, paymentStatusLabel } from '../../constants/orderStatus'
import { formatCurrency, formatDateTime } from '../../utils/format'

const PAGE_SIZE = 10
const METHODS = ['COD', 'Chuyển khoản']

const ACTIONS = {
  confirm: { label: 'Xác nhận đã thanh toán', submit: 'Xác nhận', needNote: false, needTx: true },
  fail: { label: 'Đánh dấu thất bại', submit: 'Đánh dấu thất bại', needNote: true, needTx: false, noteLabel: 'Lý do (bắt buộc)' },
  refund: { label: 'Hoàn tiền', submit: 'Hoàn tiền', needNote: true, needTx: false, noteLabel: 'Lý do hoàn tiền (bắt buộc)' },
}

// Việc nào làm được với đơn ở trạng thái thanh toán / đơn hàng nào (khớp quy tắc ở backend).
function availableActions(p) {
  const closed = p.status === 'CANCELLED' || p.status === 'RETURNED'
  const out = []
  if ((p.paymentStatus === 'AWAITING_PAYMENT' || p.paymentStatus === 'FAILED') && !closed) out.push('confirm')
  if (p.paymentStatus === 'AWAITING_PAYMENT') out.push('fail')
  if (p.paymentStatus === 'PAID') out.push('refund')
  return out
}

function SummaryCard({ title, value, sub, tone }) {
  return (
    <div className={`pay-card ${tone ? `pay-card-${tone}` : ''}`}>
      <span className="pay-card-title">{title}</span>
      <strong className="pay-card-value">{value}</strong>
      {sub && <span className="pay-card-sub">{sub}</span>}
    </div>
  )
}

export default function PaymentsAdmin() {
  const [summary, setSummary] = useState(null)
  const [unmatched, setUnmatched] = useState([])
  const [showUnmatched, setShowUnmatched] = useState(false)
  const [list, setList] = useState({ items: [], total: 0 })
  const [filters, setFilters] = useState({ search: '', status: '', method: '', dateFrom: '', dateTo: '' })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [action, setAction] = useState(null) // { type, payment }
  const [form, setForm] = useState({ transactionId: '', note: '' })
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page, pageSize: PAGE_SIZE })
      for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v)
      const [s, l] = await Promise.all([api.get('/payments/summary'), api.get(`/payments?${params}`)])
      setSummary(s)
      setList(l)
      setUnmatched(s.alerts.unmatchedCount > 0 ? (await api.get('/payments/unmatched')).items : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  useEffect(() => {
    load()
  }, [load])

  function setFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }))
    setPage(1)
  }

  function openAction(type, payment) {
    setAction({ type, payment })
    setForm({ transactionId: '', note: '' })
    setActionError('')
  }

  async function submitAction() {
    const { type, payment } = action
    const cfg = ACTIONS[type]
    if (cfg.needNote && !form.note.trim()) return setActionError('Vui lòng nhập lý do.')
    setSaving(true)
    setActionError('')
    try {
      await api.post(`/payments/${payment.id}/${type}`, {
        ...(form.transactionId.trim() ? { transactionId: form.transactionId.trim() } : {}),
        ...(form.note.trim() ? { note: form.note.trim() } : {}),
      })
      setAction(null)
      await load()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(list.total / PAGE_SIZE))
  const st = summary?.statuses
  const alerts = summary?.alerts
  const hasAlerts =
    alerts &&
    (alerts.codDeliveredUnpaid > 0 || alerts.transferOverdue > 0 || alerts.cancelledPaid > 0 || alerts.unmatchedCount > 0 || alerts.mismatchCount > 0)
  const enabledHooks = summary ? Object.values(summary.webhooks).filter((w) => w.enabled).map((w) => w.name) : []

  return (
    <AdminLayout activeNav="payments" pageTitle="Thanh toán">
      {st && (
        <section className="pay-cards">
          <SummaryCard title="Chờ thanh toán" value={formatCurrency(st.AWAITING_PAYMENT.amount)} sub={`${st.AWAITING_PAYMENT.count} đơn`} tone="warn" />
          <SummaryCard title="Đã thanh toán" value={formatCurrency(st.PAID.amount)} sub={`${st.PAID.count} đơn`} tone="ok" />
          <SummaryCard title="Thất bại" value={formatCurrency(st.FAILED.amount)} sub={`${st.FAILED.count} đơn`} />
          <SummaryCard title="Đã hoàn tiền" value={formatCurrency(st.REFUNDED.amount)} sub={`${st.REFUNDED.count} đơn`} />
        </section>
      )}

      {summary && (
        <p className={`pay-auto ${enabledHooks.length ? 'pay-auto-on' : ''}`}>
          {enabledHooks.length
            ? `✓ Tự động xác nhận chuyển khoản đang bật (${enabledHooks.join(', ')}): đủ tiền và đúng mã đơn thì đơn tự chuyển sang "Đã thanh toán".`
            : 'Tự động xác nhận chuyển khoản chưa bật: bạn kiểm tra tài khoản rồi bấm "Xác nhận đã thanh toán". Muốn bật khi deploy, xem hướng dẫn trong file backend/.env.example.'}
        </p>
      )}

      {hasAlerts && (
        <div className="pay-alerts">
          {alerts.codDeliveredUnpaid > 0 && (
            <div>
              <b>{alerts.codDeliveredUnpaid}</b> đơn COD đã giao nhưng chưa xác nhận thu tiền.{' '}
              <button className="pay-link" onClick={() => { setFilters({ search: '', status: 'AWAITING_PAYMENT', method: 'COD', dateFrom: '', dateTo: '' }); setPage(1) }}>Xem</button>
            </div>
          )}
          {alerts.transferOverdue > 0 && (
            <div>
              <b>{alerts.transferOverdue}</b> đơn chuyển khoản quá 24 giờ chưa thấy thanh toán.{' '}
              <button className="pay-link" onClick={() => { setFilters({ search: '', status: 'AWAITING_PAYMENT', method: 'Chuyển khoản', dateFrom: '', dateTo: '' }); setPage(1) }}>Xem</button>
            </div>
          )}
          {alerts.mismatchCount > 0 && (
            <div>
              <b>{alerts.mismatchCount}</b> đơn khách đã chuyển khoản nhưng <b>thiếu tiền</b>, chưa tự xác nhận. Xem lịch sử đơn để biết thiếu bao nhiêu.
            </div>
          )}
          {alerts.unmatchedCount > 0 && (
            <div>
              <b>{alerts.unmatchedCount}</b> khoản tiền về tài khoản (30 ngày qua) không khớp đơn nào (sai hoặc thiếu mã đơn, đơn đã hủy, chuyển trùng...).{' '}
              <button className="pay-link" onClick={() => setShowUnmatched((v) => !v)}>{showUnmatched ? 'Ẩn' : 'Xem danh sách'}</button>
            </div>
          )}
          {alerts.cancelledPaid > 0 && (
            <div>
              <b>{alerts.cancelledPaid}</b> đơn đã hủy hoặc trả hàng nhưng đã thu tiền, cần hoàn tiền cho khách.
            </div>
          )}
        </div>
      )}

      {showUnmatched && unmatched.length > 0 && (
        <div className="dash-card pay-unmatched">
          <h3 className="form-card-title">Tiền về chưa khớp đơn</h3>
          <table className="dash-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {unmatched.map((u) => (
                <tr key={u.id}>
                  <td>{formatDateTime(u.createdAt)}</td>
                  <td>{u.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="pay-sub">Tìm đơn tương ứng ở bảng dưới (theo số điện thoại hoặc số tiền) rồi bấm "Xác nhận đã thanh toán", hoặc hoàn tiền cho khách nếu chuyển nhầm.</p>
        </div>
      )}

      <div className="dash-toolbar">
        <input
          type="text"
          className="dash-input"
          placeholder="Tìm mã đơn, mã giao dịch, tên, SĐT..."
          value={filters.search}
          onChange={(e) => setFilter('search', e.target.value)}
        />
        <select className="dash-select" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(PAYMENT_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select className="dash-select" value={filters.method} onChange={(e) => setFilter('method', e.target.value)}>
          <option value="">Mọi phương thức</option>
          {METHODS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <input type="date" className="dash-input" value={filters.dateFrom} onChange={(e) => setFilter('dateFrom', e.target.value)} aria-label="Từ ngày" />
        <input type="date" className="dash-input" value={filters.dateTo} onChange={(e) => setFilter('dateTo', e.target.value)} aria-label="Đến ngày" />
      </div>

      {action && (
        <div className="dash-card pay-action">
          <h3 className="form-card-title">
            {ACTIONS[action.type].label} · đơn {action.payment.orderNumber} · {formatCurrency(action.payment.total)}
          </h3>
          {ACTIONS[action.type].needTx && (
            <label className="pay-field">
              <span>Mã giao dịch (nếu có)</span>
              <input className="dash-input" value={form.transactionId} maxLength={100} onChange={(e) => setForm({ ...form, transactionId: e.target.value })} />
            </label>
          )}
          <label className="pay-field">
            <span>{ACTIONS[action.type].noteLabel || 'Ghi chú (không bắt buộc)'}</span>
            <input className="dash-input" value={form.note} maxLength={300} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </label>
          {actionError && <p className="pay-error">{actionError}</p>}
          <div className="dash-row-actions">
            <button onClick={submitAction} disabled={saving}>{saving ? 'Đang lưu...' : ACTIONS[action.type].submit}</button>
            <button onClick={() => setAction(null)} disabled={saving}>Hủy</button>
          </div>
        </div>
      )}

      {error && <div className="dash-card pay-error">{error}</div>}

      {loading && list.items.length === 0 ? (
        <div className="dash-card" style={{ textAlign: 'center', padding: '40px' }}>Đang tải...</div>
      ) : list.items.length === 0 ? (
        <div className="dash-card" style={{ textAlign: 'center', padding: '40px' }}>
          <p className="dash-empty-state">Không có giao dịch nào khớp bộ lọc.</p>
        </div>
      ) : (
        <div className="dash-card dash-card-wide">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Đơn hàng</th>
                <th>Ngày đặt</th>
                <th>Khách</th>
                <th>Phương thức</th>
                <th>Số tiền</th>
                <th>Thanh toán</th>
                <th>Mã giao dịch</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((p) => {
                const acts = availableActions(p)
                return (
                  <tr key={p.id}>
                    <td>
                      <Link className="pay-link" to={`/dashboard/orders/${p.id}`}>{p.orderNumber}</Link>
                      <div className="pay-sub">{ORDER_STATUS[p.status]?.label || p.status}</div>
                    </td>
                    <td>{formatDateTime(p.createdAt)}</td>
                    <td>
                      {p.customer?.name || p.recipientName}
                      <div className="pay-sub">{p.recipientPhone}</div>
                    </td>
                    <td>{p.paymentMethod}</td>
                    <td><strong>{formatCurrency(Number(p.total))}</strong></td>
                    <td>
                      <span className={`order-status-badge ${PAYMENT_STATUS[p.paymentStatus]?.cls || ''}`}>{paymentStatusLabel(p.paymentStatus)}</span>
                    </td>
                    <td>{p.transactionId || '—'}</td>
                    <td>
                      <div className="dash-row-actions">
                        {acts.length === 0 && '—'}
                        {acts.map((t) => (
                          <button key={t} onClick={() => openAction(t, p)}>{ACTIONS[t].label}</button>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="pay-pager">
            <span>{list.total} giao dịch</span>
            <button disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>← Trước</button>
            <span>Trang {page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((n) => n + 1)}>Sau →</button>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
