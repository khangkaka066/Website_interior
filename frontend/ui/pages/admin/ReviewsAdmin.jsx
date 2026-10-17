'use client'

import { useCallback, useEffect, useState } from 'react'
import AdminLayout from '../../components/dashboard/AdminLayout'
import { Link, useSearchParams } from '@/lib/router'
import { api } from '../../api'

const muted = { fontSize: '12px', color: 'var(--dash-muted)' }
const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n)
const day = (d) => new Date(d).toLocaleDateString('vi-VN')
const PAGE_SIZE = 20

// Tất cả đánh giá của khách (kể cả đã ẩn): lọc theo số sao / trạng thái / từ khóa, ẩn hoặc hiện từng đánh giá.
export default function ReviewsAdmin() {
  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState({ rating: '', status: searchParams.get('status') || '', q: '' }) // ?status=unanswered từ khối "Việc cần làm"
  const [query, setQuery] = useState(filters) // bộ lọc đã áp dụng (từ khóa chỉ gửi khi bấm Tìm)
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [replying, setReplying] = useState(null) // { id, text } khung trả lời đang mở

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    for (const k of ['rating', 'status', 'q']) if (query[k]) params.set(k, query[k])
    try {
      setData(await api.get(`/orders/reviews?${params}`))
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }, [page, query])
  useEffect(() => {
    load()
  }, [load])

  function apply(next) {
    setFilters(next)
    setQuery(next)
    setPage(1)
  }

  async function toggle(r) {
    setBusyId(r.id)
    try {
      await api.patch(`/orders/reviews/${r.id}`, { hidden: !r.hidden })
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId('')
    }
  }

  async function sendReply() {
    setBusyId(replying.id)
    try {
      await api.patch(`/orders/reviews/${replying.id}/reply`, { reply: replying.text.trim() })
      setReplying(null)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId('')
    }
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  return (
    <AdminLayout activeNav="reviews" pageTitle="Đánh giá sản phẩm">
      {data && (
        <div className="dash-card" style={{ padding: '16px', marginBottom: '16px', display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
          <div><strong style={{ fontSize: '24px' }}>{data.stats.total}</strong><div style={muted}>Tổng đánh giá</div></div>
          <div><strong style={{ fontSize: '24px' }}>{data.stats.average ? data.stats.average.toFixed(1) : '—'} ★</strong><div style={muted}>Điểm trung bình</div></div>
          <div><strong style={{ fontSize: '24px', color: data.stats.unanswered ? 'var(--dash-danger)' : undefined }}>{data.stats.unanswered}</strong><div style={muted}>Chưa trả lời</div></div>
          <div><strong style={{ fontSize: '24px' }}>{data.stats.hidden}</strong><div style={muted}>Đang ẩn</div></div>
        </div>
      )}

      <div className="dash-card" style={{ padding: '16px' }}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            apply(filters)
          }}
          style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}
        >
          <input className="dash-input" style={{ flex: '1 1 240px' }} placeholder="Tìm theo nội dung, tên khách, sản phẩm, mã đơn…" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
          <select className="dash-select" value={filters.rating} onChange={(e) => apply({ ...filters, rating: e.target.value })} aria-label="Lọc theo số sao">
            <option value="">Tất cả số sao</option>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} sao</option>)}
          </select>
          <select className="dash-select" value={filters.status} onChange={(e) => apply({ ...filters, status: e.target.value })} aria-label="Lọc theo trạng thái">
            <option value="">Mọi trạng thái</option>
            <option value="unanswered">Chưa trả lời</option>
            <option value="visible">Đang hiện</option>
            <option value="hidden">Đã ẩn</option>
          </select>
          <button className="dash-btn">Tìm</button>
        </form>

        {error && <p style={{ color: 'var(--dash-danger)', fontSize: '13px', marginBottom: '10px' }} role="alert">{error}</p>}
        {!data && !error && <p style={muted}>Đang tải…</p>}
        {data && data.items.length === 0 && <p style={muted}>Không có đánh giá nào phù hợp.</p>}
        {data && data.items.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="dash-table">
              <thead>
                <tr><th>Sản phẩm</th><th>Đánh giá</th><th>Khách</th><th>Ngày</th><th>Đơn</th><th /></tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.id} style={{ opacity: r.hidden ? 0.55 : 1 }}>
                    <td style={{ maxWidth: '220px' }}>
                      {r.productName}
                      {r.variant && <div style={muted}>{r.variant}</div>}
                    </td>
                    <td style={{ maxWidth: '360px' }}>
                      <span style={{ color: '#d9ad3c', letterSpacing: '1px' }} aria-label={`${r.rating} trên 5 sao`}>{stars(r.rating)}</span>
                      {r.hidden && <span style={{ ...muted, marginLeft: '8px' }}>(đã ẩn)</span>}
                      {r.comment && <div style={{ marginTop: '4px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.comment}</div>}
                      {r.reply && replying?.id !== r.id && (
                        <div style={{ marginTop: '8px', padding: '8px 10px', background: 'var(--dash-hover-bg)', borderLeft: '3px solid var(--dash-primary)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                          <strong style={{ fontSize: '12px' }}>Shop đã trả lời:</strong> {r.reply}
                        </div>
                      )}
                      {replying?.id === r.id && (
                        <div style={{ marginTop: '8px' }}>
                          <textarea className="dash-input" rows={3} maxLength={1000} autoFocus style={{ width: '100%' }} placeholder="Viết phản hồi (hiện công khai dưới đánh giá)…" value={replying.text} onChange={(e) => setReplying({ id: r.id, text: e.target.value })} />
                          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                            <button type="button" className="dash-btn" disabled={busyId === r.id} onClick={sendReply}>{replying.text.trim() ? 'Gửi phản hồi' : 'Xóa phản hồi'}</button>
                            <button type="button" className="dash-btn dash-btn-ghost" onClick={() => setReplying(null)}>Hủy</button>
                          </div>
                        </div>
                      )}
                    </td>
                    <td>{r.authorName}</td>
                    <td>{day(r.createdAt)}</td>
                    <td>{r.order ? <Link to={`/dashboard/orders/${r.order.id}`}>{r.order.orderNumber}</Link> : '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {!r.hidden && (
                        <button type="button" className="dash-btn dash-btn-ghost" onClick={() => setReplying({ id: r.id, text: r.reply || '' })}>
                          {r.reply ? 'Sửa phản hồi' : 'Trả lời'}
                        </button>
                      )}{' '}
                      <button type="button" className="dash-btn dash-btn-ghost" disabled={busyId === r.id} onClick={() => toggle(r)}>
                        {r.hidden ? 'Hiện' : 'Ẩn'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && pages > 1 && (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'center', marginTop: '16px' }}>
            <button type="button" className="dash-btn dash-btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Trước</button>
            <span style={muted}>Trang {page} / {pages}</span>
            <button type="button" className="dash-btn dash-btn-ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Sau →</button>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
