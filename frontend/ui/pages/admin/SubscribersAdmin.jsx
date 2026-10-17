'use client'

import { useCallback, useEffect, useState } from 'react'
import AdminLayout from '../../components/dashboard/AdminLayout'
import { api } from '../../api'

const muted = { fontSize: '12px', color: 'var(--dash-muted)' }
const day = (d) => new Date(d).toLocaleDateString('vi-VN')
const dayTime = (d) => new Date(d).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })

// Email đăng ký nhận ưu đãi: xem danh sách / xuất CSV, cấu hình quà chào mừng (mã giảm giá riêng gửi qua email) và gửi chiến dịch khuyến mãi.
export default function SubscribersAdmin() {
  const [data, setData] = useState(null)
  const [query, setQuery] = useState({ q: '', status: '' })
  const [draftQ, setDraftQ] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    const sp = new URLSearchParams({ page: String(page) })
    if (query.q) sp.set('q', query.q)
    if (query.status) sp.set('status', query.status)
    try {
      setData(await api.get(`/subscribers?${sp}`))
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }, [page, query])
  useEffect(() => {
    load()
  }, [load])

  async function remove(s) {
    if (!window.confirm(`Xóa ${s.email} khỏi danh sách?`)) return
    try {
      await api.delete(`/subscribers/${s.id}`)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function exportCsv() {
    try {
      const { items } = await api.get('/subscribers/export')
      const csv = '﻿email,ngay_dang_ky\n' + items.map((i) => `${i.email},${day(i.createdAt)}`).join('\n') // BOM để Excel đọc đúng
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'email-dang-ky.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    }
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  return (
    <AdminLayout activeNav="subscribers" pageTitle="Email đăng ký">
      {error && <div className="dash-card" style={{ padding: '14px 16px', color: 'var(--dash-danger)' }} role="alert">{error}</div>}
      {notice && <div className="dash-card" style={{ padding: '14px 16px', color: 'var(--dash-success)' }} role="status">{notice}</div>}

      {data && (
        <div className="dash-card" style={{ padding: '16px', display: 'flex', gap: '32px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div><strong style={{ fontSize: '28px', fontWeight: 800 }}>{data.stats.active}</strong><div style={muted}>Đang đăng ký</div></div>
          <div><strong style={{ fontSize: '28px', fontWeight: 800 }}>{data.stats.unsubscribed}</strong><div style={muted}>Đã hủy</div></div>
          {!data.mailConfigured && (
            <p style={{ ...muted, color: 'var(--dash-danger)', flex: '1 1 280px', fontSize: '13px' }}>
              Máy chủ chưa cấu hình email gửi đi (SMTP_HOST, SMTP_USER, SMTP_PASS trong file .env của backend), nên email chào mừng và chiến dịch chưa gửi được. Nội dung chỉ in ra log máy chủ.
            </p>
          )}
        </div>
      )}

      {data && <WelcomeConfig initial={data.welcome} onSaved={(m) => { setNotice(m); setTimeout(() => setNotice(''), 4000) }} onError={setError} />}

      <div className="dash-card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '14px', alignItems: 'center' }}>
          <h3 style={{ marginRight: 'auto' }}>Danh sách email</h3>
          <form onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery((q) => ({ ...q, q: draftQ.trim() })) }} style={{ display: 'flex', gap: '8px' }}>
            <input className="dash-input" placeholder="Tìm email…" value={draftQ} onChange={(e) => setDraftQ(e.target.value)} />
            <button className="dash-btn">Tìm</button>
          </form>
          <select className="dash-select" value={query.status} onChange={(e) => { setPage(1); setQuery((q) => ({ ...q, status: e.target.value })) }} aria-label="Lọc trạng thái">
            <option value="">Tất cả</option>
            <option value="active">Đang đăng ký</option>
            <option value="unsubscribed">Đã hủy</option>
          </select>
          <button type="button" className="dash-btn dash-btn-ghost" onClick={exportCsv}>Xuất CSV</button>
        </div>
        {data && data.items.length === 0 && <p style={muted}>Chưa có email nào.</p>}
        {data && data.items.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="dash-table">
              <thead><tr><th>Email</th><th>Ngày đăng ký</th><th>Mã chào mừng</th><th>Trạng thái</th><th /></tr></thead>
              <tbody>
                {data.items.map((s) => (
                  <tr key={s.id}>
                    <td>{s.email}</td>
                    <td>{day(s.createdAt)}</td>
                    <td>{s.welcomeCode || '—'}</td>
                    <td>{s.unsubscribedAt ? <span className="order-status-badge status-cancelled">Đã hủy {day(s.unsubscribedAt)}</span> : <span className="order-status-badge status-delivered">Đang đăng ký</span>}</td>
                    <td><button type="button" className="dash-btn dash-btn-ghost" onClick={() => remove(s)}>Xóa</button></td>
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

      {data && <Campaigns active={data.stats.active} mailConfigured={data.mailConfigured} onError={setError} onNotice={(m) => { setNotice(m); setTimeout(() => setNotice(''), 5000) }} />}
    </AdminLayout>
  )
}

// Quà chào mừng: mỗi người đăng ký mới nhận một mã giảm giá riêng dùng một lần, gửi qua email.
function WelcomeConfig({ initial, onSaved, onError }) {
  const [f, setF] = useState(initial)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await api.put('/subscribers/welcome', { welcomeEnabled: f.welcomeEnabled, welcomeType: f.welcomeType, welcomeValue: Number(f.welcomeValue), welcomeMaxDiscount: Number(f.welcomeMaxDiscount) || 0, welcomeMinOrder: Number(f.welcomeMinOrder) || 0, welcomeDays: Number(f.welcomeDays) || 0 })
      onSaved('Đã lưu cấu hình quà chào mừng.')
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="dash-card" style={{ padding: '16px' }}>
      <h3 style={{ marginBottom: '4px' }}>Quà chào mừng</h3>
      <p style={{ ...muted, marginBottom: '12px' }}>Người đăng ký mới nhận ngay một mã giảm giá riêng (dùng một lần) qua email. Mã tự xuất hiện trong trang Mã giảm giá.</p>
      <form onSubmit={save} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', alignItems: 'end' }}>
        <label style={{ fontSize: '13px', display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={f.welcomeEnabled} onChange={set('welcomeEnabled')} /> Bật tặng mã</label>
        <div className="dash-form-field"><label>Loại giảm</label>
          <select className="dash-select" value={f.welcomeType} onChange={set('welcomeType')}><option value="PERCENT">Phần trăm (%)</option><option value="FIXED">Số tiền cố định (đ)</option></select>
        </div>
        <div className="dash-form-field"><label>{f.welcomeType === 'PERCENT' ? 'Giảm (%)' : 'Giảm (đ)'}</label><input type="number" min={1} value={f.welcomeValue} onChange={set('welcomeValue')} /></div>
        {f.welcomeType === 'PERCENT' && <div className="dash-form-field"><label>Giảm tối đa (đ)</label><input type="number" min={0} value={f.welcomeMaxDiscount} onChange={set('welcomeMaxDiscount')} placeholder="0 = không giới hạn" /></div>}
        <div className="dash-form-field"><label>Đơn tối thiểu (đ)</label><input type="number" min={0} value={f.welcomeMinOrder} onChange={set('welcomeMinOrder')} /></div>
        <div className="dash-form-field"><label>Hiệu lực (ngày)</label><input type="number" min={0} value={f.welcomeDays} onChange={set('welcomeDays')} placeholder="0 = không hết hạn" /></div>
        <button className="dash-btn" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu'}</button>
      </form>
    </div>
  )
}

// Soạn và gửi chiến dịch khuyến mãi tới mọi người đang đăng ký (mỗi email có link hủy đăng ký riêng).
function Campaigns({ active, mailConfigured, onError, onNotice }) {
  const [form, setForm] = useState({ subject: '', body: '' })
  const [testTo, setTestTo] = useState('')
  const [busy, setBusy] = useState('')
  const [blasts, setBlasts] = useState([])
  const [sendingId, setSendingId] = useState(null)

  const loadBlasts = useCallback(async () => {
    try {
      const r = await api.get('/subscribers/blasts')
      setBlasts(r.items)
      setSendingId(r.sendingId)
    } catch {
      // bỏ qua: lần sau thử lại
    }
  }, [])
  useEffect(() => {
    loadBlasts()
  }, [loadBlasts])
  // Đang gửi thì cập nhật tiến độ mỗi 3 giây.
  useEffect(() => {
    if (!sendingId && !blasts.some((b) => b.status === 'SENDING')) return undefined
    const t = setInterval(loadBlasts, 3000)
    return () => clearInterval(t)
  }, [sendingId, blasts, loadBlasts])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const ready = form.subject.trim() && form.body.trim()

  async function sendTest() {
    setBusy('test')
    try {
      await api.post('/subscribers/blasts/test', { ...form, to: testTo })
      onNotice(`Đã gửi email thử tới ${testTo}.`)
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy('')
    }
  }
  async function send() {
    if (!window.confirm(`Gửi email "${form.subject}" tới ${active} người đang đăng ký? Không thể thu hồi sau khi gửi.`)) return
    setBusy('send')
    try {
      await api.post('/subscribers/blasts', form)
      setForm({ subject: '', body: '' })
      onNotice('Đã bắt đầu gửi. Tiến độ hiện ở bảng bên dưới.')
      await loadBlasts()
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="dash-card" style={{ padding: '16px' }}>
      <h3 style={{ marginBottom: '4px' }}>Gửi email khuyến mãi</h3>
      <p style={{ ...muted, marginBottom: '12px' }}>Gửi tới {active} người đang đăng ký. Mỗi email tự có link "Hủy đăng ký". Nội dung là văn bản thường, dòng trống để xuống đoạn mới.</p>
      <div style={{ display: 'grid', gap: '12px', maxWidth: '720px' }}>
        <div className="dash-form-field"><label>Tiêu đề</label><input value={form.subject} onChange={set('subject')} maxLength={150} placeholder="VD: Rèm mới về, giảm 15% tuần này" /></div>
        <div className="dash-form-field"><label>Nội dung</label><textarea rows={8} value={form.body} onChange={set('body')} maxLength={10000} placeholder={'Xin chào,\n\nTuần này shop có…'} style={{ width: '100%', resize: 'vertical' }} /></div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="dash-input" type="email" placeholder="Email nhận thử" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
          <button type="button" className="dash-btn dash-btn-ghost" disabled={!ready || !testTo || busy !== ''} onClick={sendTest}>{busy === 'test' ? 'Đang gửi…' : 'Gửi thử'}</button>
          <button type="button" className="dash-btn" style={{ marginLeft: 'auto' }} disabled={!ready || busy !== '' || !!sendingId || !mailConfigured || active === 0} onClick={send} title={!mailConfigured ? 'Chưa cấu hình SMTP' : ''}>
            {busy === 'send' ? 'Đang bắt đầu…' : sendingId ? 'Đang có đợt gửi chạy…' : `Gửi cho ${active} người`}
          </button>
        </div>
      </div>

      {blasts.length > 0 && (
        <div style={{ overflowX: 'auto', marginTop: '20px' }}>
          <table className="dash-table">
            <thead><tr><th>Tiêu đề</th><th>Bắt đầu</th><th>Đã gửi</th><th>Lỗi</th><th>Trạng thái</th></tr></thead>
            <tbody>
              {blasts.map((b) => (
                <tr key={b.id}>
                  <td>{b.subject}</td>
                  <td>{dayTime(b.createdAt)}</td>
                  <td>{b.sent} / {b.total}</td>
                  <td>{b.failed}</td>
                  <td>{b.status === 'SENDING' ? <span className="order-status-badge status-processing">Đang gửi…</span> : <span className="order-status-badge status-delivered">Xong</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
