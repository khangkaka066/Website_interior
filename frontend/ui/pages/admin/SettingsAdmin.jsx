'use client'

import { useState, useEffect } from 'react'
import { Link, useSearchParams } from '@/lib/router'
import AdminLayout from '../../components/dashboard/AdminLayout'
import AccountsPanel from './AccountsAdmin'
import { api } from '../../api'
import { formatCurrency } from '../../utils/format'
import { BANKS } from '../../data/banks'
import TransferQr from '../../components/TransferQr'
import { fillTransferNote } from '../../utils/vietqr'

const TABS = [
  { id: 'store', label: 'Cửa hàng' },
  { id: 'payment', label: 'Thanh toán' },
  { id: 'shipping', label: 'Vận chuyển' },
  { id: 'content', label: 'Nội dung trang' },
  { id: 'accounts', label: 'Tài khoản & Phân quyền' },
]

function Field({ label, hint, children }) {
  return (
    <label className="set-field">
      <span className="set-label">{label}</span>
      {children}
      {hint && <span className="set-hint">{hint}</span>}
    </label>
  )
}

// Lưu một nhóm cài đặt và báo kết quả ngay tại chỗ.
function useSave(section, onSaved) {
  const [state, setState] = useState({ saving: false, error: '', ok: false })
  async function save(value) {
    setState({ saving: true, error: '', ok: false })
    try {
      const saved = await api.put(`/settings/${section}`, value)
      onSaved(section, saved)
      setState({ saving: false, error: '', ok: true })
    } catch (err) {
      setState({ saving: false, error: err.message, ok: false })
    }
  }
  return [state, save]
}

function SaveBar({ state, dirty }) {
  return (
    <div className="set-savebar">
      <button type="submit" className="set-save" disabled={state.saving || !dirty}>
        {state.saving ? 'Đang lưu...' : 'Lưu thay đổi'}
      </button>
      {state.ok && !dirty && <span className="set-ok">✓ Đã lưu</span>}
      {state.error && <span className="set-error">{state.error}</span>}
    </div>
  )
}

function StoreTab({ data, onSaved }) {
  const [form, setForm] = useState(data)
  const [state, save] = useSave('store', onSaved)
  const dirty = JSON.stringify(form) !== JSON.stringify(data)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  return (
    <form
      className="dash-card set-card"
      onSubmit={(e) => {
        e.preventDefault()
        save(form)
      }}
    >
      <h3 className="form-card-title">Thông tin cửa hàng</h3>
      <div className="set-grid">
        <Field label="Tên cửa hàng *"><input className="dash-input" value={form.name} onChange={set('name')} maxLength={80} /></Field>
        <Field label="Khẩu hiệu"><input className="dash-input" value={form.tagline} onChange={set('tagline')} maxLength={120} /></Field>
        <Field label="Hotline *"><input className="dash-input" value={form.hotline} onChange={set('hotline')} maxLength={30} /></Field>
        <Field label="Email liên hệ"><input className="dash-input" value={form.email} onChange={set('email')} maxLength={120} /></Field>
        <Field label="Địa chỉ *"><input className="dash-input" value={form.address} onChange={set('address')} maxLength={200} /></Field>
      </div>
      <SaveBar state={state} dirty={dirty} />
    </form>
  )
}

function PaymentTab({ data, onSaved }) {
  const [methods, setMethods] = useState(data.methods)
  const [state, save] = useSave('payment', onSaved)
  const dirty = JSON.stringify(methods) !== JSON.stringify(data.methods)
  const update = (i, patch) => setMethods((ms) => ms.map((m, k) => (k === i ? { ...m, ...patch } : m)))
  const updateBank = (i, patch) => setMethods((ms) => ms.map((m, k) => (k === i ? { ...m, bank: { ...m.bank, ...patch } } : m)))
  return (
    <form
      className="dash-card set-card"
      onSubmit={(e) => {
        e.preventDefault()
        save({ methods })
      }}
    >
      <h3 className="form-card-title">Phương thức thanh toán</h3>
      <p className="set-hint">Chỉ phương thức đang bật mới hiện cho khách ở trang thanh toán, và máy chủ cũng chỉ nhận đơn theo các phương thức này.</p>
      {methods.map((m, i) => (
        <div className={`set-method ${m.enabled ? '' : 'set-method-off'}`} key={m.id}>
          <label className="set-toggle">
            <input type="checkbox" checked={m.enabled} onChange={(e) => update(i, { enabled: e.target.checked })} />
            <strong>{m.id === 'COD' ? 'Thanh toán khi nhận hàng (COD)' : 'Chuyển khoản ngân hàng'}</strong>
            <span className="set-hint">{m.enabled ? 'Đang bật' : 'Đang tắt'}</span>
          </label>
          <div className="set-grid">
            <Field label="Tên hiển thị cho khách"><input className="dash-input" value={m.label} onChange={(e) => update(i, { label: e.target.value })} maxLength={80} /></Field>
            <Field label="Mô tả ngắn"><input className="dash-input" value={m.description || ''} onChange={(e) => update(i, { description: e.target.value })} maxLength={200} /></Field>
          </div>
          {m.bank && (
            <div className="set-grid">
              <Field label="Ngân hàng">
                <select
                  className="dash-select"
                  value={m.bank.bankCode || ''}
                  onChange={(e) => {
                    const b = BANKS.find((x) => x.bin === e.target.value)
                    updateBank(i, { bankCode: b?.bin || '', bankName: b?.name || '' })
                  }}
                >
                  <option value="">— Chọn ngân hàng —</option>
                  {BANKS.map((b) => (
                    <option key={b.bin} value={b.bin}>{b.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Số tài khoản" hint="Chỉ gồm chữ số, không dấu cách."><input className="dash-input" inputMode="numeric" value={m.bank.accountNumber} onChange={(e) => updateBank(i, { accountNumber: e.target.value.replace(/[^\d]/g, '') })} maxLength={19} /></Field>
              <Field label="Chủ tài khoản"><input className="dash-input" value={m.bank.accountHolder} onChange={(e) => updateBank(i, { accountHolder: e.target.value })} maxLength={80} /></Field>
              <Field label="Nội dung chuyển khoản" hint="{order} sẽ được thay bằng mã đơn hàng của khách. Ví dụ: CLEVINUM {order}"><input className="dash-input" value={m.bank.transferNote} onChange={(e) => updateBank(i, { transferNote: e.target.value })} maxLength={120} /></Field>
            </div>
          )}
          {m.bank && m.enabled && m.bank.bankCode && m.bank.accountNumber.length >= 6 && (
            <div className="set-qr-preview">
              <span className="set-label">Xem thử mã QR khách sẽ thấy (đơn mẫu 100.000đ, mã ORD-10293). Bạn quét thử bằng app ngân hàng để kiểm tra đúng tài khoản.</span>
              <TransferQr bank={m.bank} amount={100000} note={fillTransferNote(m.bank.transferNote, 'ORD-10293')} />
            </div>
          )}
        </div>
      ))}
      <div className="set-auto">
        <strong>Tự động xác nhận khi khách chuyển khoản</strong>
        <p className="set-hint">
          Khi deploy, nối với SePay hoặc Casso để đơn tự chuyển sang "Đã thanh toán" khi tiền về (đúng mã đơn, đủ tiền). Việc cần làm: điền khóa
          bí mật vào file <code>backend/.env</code> (xem hướng dẫn từng bước trong <code>backend/.env.example</code>) và khai báo địa chỉ webhook{' '}
          <code>/api/payments/webhook/sepay</code> hoặc <code>/api/payments/webhook/casso</code> ở dịch vụ đó. Số tài khoản nhận tiền ở trên được dùng
          để bỏ qua giao dịch về tài khoản khác. Trạng thái bật/tắt xem ở mục Thanh toán.
        </p>
      </div>
      <SaveBar state={state} dirty={dirty} />
    </form>
  )
}

function ShippingTab({ data, onSaved }) {
  const [form, setForm] = useState({ fee: String(data.fee), freeShippingOver: String(data.freeShippingOver) })
  const [state, save] = useSave('shipping', onSaved)
  const num = (v) => (v === '' ? NaN : Number(v))
  const dirty = num(form.fee) !== data.fee || num(form.freeShippingOver) !== data.freeShippingOver
  const digits = (k) => (e) => setForm({ ...form, [k]: e.target.value.replace(/[^\d]/g, '') })
  return (
    <>
      <form
        className="dash-card set-card"
        onSubmit={(e) => {
          e.preventDefault()
          save({ fee: num(form.fee), freeShippingOver: num(form.freeShippingOver) })
        }}
      >
        <h3 className="form-card-title">Phí vận chuyển</h3>
        <div className="set-grid">
          <Field label="Phí vận chuyển mặc định (đ)" hint={Number.isFinite(num(form.fee)) ? formatCurrency(num(form.fee)) : 'Nhập số'}>
            <input className="dash-input" inputMode="numeric" value={form.fee} onChange={digits('fee')} />
          </Field>
          <Field
            label="Miễn phí vận chuyển cho đơn từ (đ)"
            hint={num(form.freeShippingOver) > 0 ? `Đơn từ ${formatCurrency(num(form.freeShippingOver))} được miễn phí` : 'Nhập 0 nếu không miễn phí'}
          >
            <input className="dash-input" inputMode="numeric" value={form.freeShippingOver} onChange={digits('freeShippingOver')} />
          </Field>
        </div>
        <SaveBar state={state} dirty={dirty} />
      </form>
      <div className="dash-card set-card">
        <h3 className="form-card-title">Đơn vị vận chuyển</h3>
        <p className="set-hint">Bật/tắt và kết nối API các đơn vị giao hàng.</p>
        <Link className="set-save set-linkbtn" to="/dashboard/shipping/carriers">Quản lý đơn vị vận chuyển →</Link>
      </div>
    </>
  )
}

function move(list, i, d) {
  const j = i + d
  if (j < 0 || j >= list.length) return list
  const next = [...list]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

// Nội dung trang Về chúng tôi / Liên hệ / FAQ hiển thị ở website (trang /about, /contact, /faq).
function ContentTab({ data, onSaved }) {
  const [form, setForm] = useState(data)
  const [state, save] = useSave('content', onSaved)
  const dirty = JSON.stringify(form) !== JSON.stringify(data)
  const setAbout = (patch) => setForm({ ...form, about: { ...form.about, ...patch } })
  const setContact = (patch) => setForm({ ...form, contact: { ...form.contact, ...patch } })
  const setFaq = (faq) => setForm({ ...form, faq })
  const setHighlights = (highlights) => setAbout({ highlights })
  const text = (obj, set, k) => ({ className: 'dash-input', value: obj[k] || '', onChange: (e) => set({ [k]: e.target.value }) })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save(form)
      }}
    >
      <div className="dash-card set-card">
        <h3 className="form-card-title">Trang "Về chúng tôi"</h3>
        <div className="set-grid">
          <Field label="Tiêu đề *"><input {...text(form.about, setAbout, 'heading')} maxLength={120} /></Field>
          <Field label="Giới thiệu ngắn"><input {...text(form.about, setAbout, 'intro')} maxLength={300} /></Field>
        </div>
        <Field label="Câu chuyện thương hiệu" hint="Xuống dòng trống để tách đoạn.">
          <textarea className="dash-input" rows={6} value={form.about.story || ''} onChange={(e) => setAbout({ story: e.target.value })} maxLength={4000} />
        </Field>
        <span className="set-label" style={{ display: 'block', marginTop: 16 }}>Điểm nổi bật (tối đa 8)</span>
        {form.about.highlights.map((h, i) => (
          <div className="set-method" key={i}>
            <div className="set-grid">
              <Field label="Tiêu đề"><input className="dash-input" value={h.title} maxLength={80} onChange={(e) => setHighlights(form.about.highlights.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))} /></Field>
              <Field label="Mô tả"><input className="dash-input" value={h.text} maxLength={300} onChange={(e) => setHighlights(form.about.highlights.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))} /></Field>
            </div>
            <div className="set-savebar">
              <button type="button" className="dash-btn-outline" onClick={() => setHighlights(move(form.about.highlights, i, -1))} disabled={i === 0}>↑</button>
              <button type="button" className="dash-btn-outline" onClick={() => setHighlights(move(form.about.highlights, i, 1))} disabled={i === form.about.highlights.length - 1}>↓</button>
              <button type="button" className="dash-btn-outline" onClick={() => setHighlights(form.about.highlights.filter((_, k) => k !== i))}>Xóa</button>
            </div>
          </div>
        ))}
        {form.about.highlights.length < 8 && (
          <div className="set-savebar">
            <button type="button" className="dash-btn-outline" onClick={() => setHighlights([...form.about.highlights, { title: '', text: '' }])}>+ Thêm điểm nổi bật</button>
          </div>
        )}
      </div>

      <div className="dash-card set-card">
        <h3 className="form-card-title">Trang "Liên hệ"</h3>
        <p className="set-hint">Hotline, email, địa chỉ lấy từ tab "Cửa hàng".</p>
        <Field label="Lời giới thiệu"><textarea className="dash-input" rows={3} value={form.contact.intro || ''} onChange={(e) => setContact({ intro: e.target.value })} maxLength={400} /></Field>
        <div className="set-grid">
          <Field label="Giờ làm việc"><input {...text(form.contact, setContact, 'hours')} maxLength={120} /></Field>
          <Field label="Link Shopee" hint="Bỏ trống thì ẩn nút."><input {...text(form.contact, setContact, 'shopeeUrl')} placeholder="https://shopee.vn/..." maxLength={300} /></Field>
          <Field label="Link Zalo"><input {...text(form.contact, setContact, 'zaloUrl')} placeholder="https://zalo.me/..." maxLength={300} /></Field>
          <Field label="Link Facebook"><input {...text(form.contact, setContact, 'facebookUrl')} placeholder="https://facebook.com/..." maxLength={300} /></Field>
        </div>
        <label className="set-toggle" style={{ marginTop: 16 }}>
          <input type="checkbox" checked={form.contact.showMap} onChange={(e) => setContact({ showMap: e.target.checked })} />
          <span>Hiện bản đồ theo địa chỉ cửa hàng</span>
        </label>
      </div>

      <div className="dash-card set-card">
        <h3 className="form-card-title">Câu hỏi thường gặp (FAQ)</h3>
        {form.faq.map((f, i) => (
          <div className="set-method" key={i}>
            <Field label={`Câu hỏi ${i + 1}`}><input className="dash-input" value={f.q} maxLength={200} onChange={(e) => setFaq(form.faq.map((x, k) => (k === i ? { ...x, q: e.target.value } : x)))} /></Field>
            <Field label="Trả lời"><textarea className="dash-input" rows={3} value={f.a} maxLength={2000} onChange={(e) => setFaq(form.faq.map((x, k) => (k === i ? { ...x, a: e.target.value } : x)))} /></Field>
            <div className="set-savebar">
              <button type="button" className="dash-btn-outline" onClick={() => setFaq(move(form.faq, i, -1))} disabled={i === 0}>↑</button>
              <button type="button" className="dash-btn-outline" onClick={() => setFaq(move(form.faq, i, 1))} disabled={i === form.faq.length - 1}>↓</button>
              <button type="button" className="dash-btn-outline" onClick={() => setFaq(form.faq.filter((_, k) => k !== i))}>Xóa</button>
            </div>
          </div>
        ))}
        {form.faq.length < 50 && (
          <div className="set-savebar">
            <button type="button" className="dash-btn-outline" onClick={() => setFaq([...form.faq, { q: '', a: '' }])}>+ Thêm câu hỏi</button>
          </div>
        )}
        <SaveBar state={state} dirty={dirty} />
      </div>
    </form>
  )
}

export default function SettingsAdmin() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'store'
  const [settings, setSettings] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/settings').then(setSettings).catch((err) => setError(err.message))
  }, [])

  const onSaved = (section, value) => setSettings((s) => ({ ...s, [section]: value }))

  return (
    <AdminLayout activeNav="settings" pageTitle="Cài đặt">
      <div className="set-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`set-tab ${tab === t.id ? 'set-tab-active' : ''}`}
            onClick={() => setParams({ tab: t.id })}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'accounts' ? (
        <AccountsPanel />
      ) : error ? (
        <div className="dash-card set-error">{error}</div>
      ) : !settings ? (
        <div className="dash-card" style={{ textAlign: 'center', padding: '40px' }}>Đang tải...</div>
      ) : tab === 'store' ? (
        <StoreTab data={settings.store} onSaved={onSaved} />
      ) : tab === 'payment' ? (
        <PaymentTab data={settings.payment} onSaved={onSaved} />
      ) : tab === 'content' ? (
        <ContentTab data={settings.content} onSaved={onSaved} />
      ) : (
        <ShippingTab data={settings.shipping} onSaved={onSaved} />
      )}
    </AdminLayout>
  )
}
