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
import AddressFields from '../../components/AddressFields'

const TABS = [
  { id: 'store', label: 'Cửa hàng' },
  { id: 'payment', label: 'Thanh toán' },
  { id: 'shipping', label: 'Vận chuyển' },
  { id: 'orders', label: 'Quy tắc đơn hàng' },
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

// Như Field nhưng không bọc <label>: ô chọn địa chỉ có danh sách thả xuống, bấm vào một mục sẽ kích hoạt lại ô nhập và mở lại danh sách nếu bị bọc.
function PlainField({ label, children }) {
  return (
    <div className="set-field">
      <span className="set-label">{label}</span>
      {children}
    </div>
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

// Các con số của vòng đời đơn (tự hủy đơn chưa thanh toán, hạn xử lý, tự xác nhận nhận hàng, thời hạn trả hàng). 0 = tắt.
const ORDER_RULES = [
  { key: 'unpaidCancelHours', label: 'Tự hủy đơn chưa thanh toán sau (giờ)', hint: 'Áp dụng cho đơn chuyển khoản / PayOS chưa trả tiền và chưa có vận đơn. Hủy xong tồn kho được trả lại. 0 = không tự hủy.' },
  { key: 'handleHours', label: 'Hạn xử lý đơn liên tỉnh (giờ)', hint: 'Tính từ lúc khách đặt; trang Đơn hàng hiện đếm ngược và báo đơn quá hạn. Chỉ nhắc nhở, không tự hủy đơn. 0 = không đếm.' },
  { key: 'intracityHandleHours', label: 'Hạn xử lý đơn nội thành (giờ)', hint: 'Nội thành = nhận hàng cùng tỉnh/thành với kho gửi (Cài đặt, Vận chuyển). 0 = không đếm.' },
  { key: 'expressHandleHours', label: 'Hạn xử lý đơn hỏa tốc (giờ)', hint: 'Đơn khách chọn dịch vụ hỏa tốc. 0 = không đếm.' },
  { key: 'cancelAutoApproveHours', label: 'Tự đồng ý yêu cầu hủy của khách sau (giờ)', hint: 'Khách xin hủy đơn đã xác nhận mà shop không phản hồi sau chừng này giờ thì hệ thống tự hủy đơn (và hủy vận đơn nếu có). 0 = chỉ nhân viên duyệt tay.' },
  { key: 'autoConfirmDelayMinutes', label: 'Tự xác nhận đơn hợp lệ sau (phút)', hint: 'Đơn đã thanh toán (và COD không quá mức bên dưới) có địa chỉ đủ tỉnh + quận/huyện sẽ tự được xác nhận sau chừng này phút (để khách còn kịp hủy). Cần bật ô "Tự xác nhận" bên dưới.' },
  { key: 'autoConfirmCodMax', label: 'Đơn COD tự xác nhận khi không quá (đồng)', hint: 'Đơn COD vượt mức này vẫn do nhân viên xác nhận. 0 = đơn COD luôn do nhân viên xác nhận (an toàn nhất vì COD dễ bị đặt khống).' },
  { key: 'pickupAlertHours', label: 'Cảnh báo hãng chưa lấy hàng sau (giờ)', hint: 'Tính từ lúc tạo vận đơn; đơn quá hạn hiện huy hiệu "Hãng chưa lấy hàng" và cảnh báo ở trang Vận chuyển. 0 = tắt.' },
  { key: 'autoReceiveDays', label: 'Tự xác nhận "đã nhận hàng" sau (ngày)', hint: 'Tính từ lúc đơn Đã giao. 0 = chỉ khách tự bấm xác nhận.' },
  { key: 'returnWindowDays', label: 'Khách được yêu cầu trả hàng trong (ngày)', hint: 'Tính từ lúc đơn Đã giao. 0 = không nhận yêu cầu trả hàng trên website.' },
]

function OrdersTab({ data, onSaved }) {
  const [form, setForm] = useState(() => ({ ...Object.fromEntries(ORDER_RULES.map((r) => [r.key, String(data[r.key])])), expressKeywords: data.expressKeywords ?? '', pickupCutoff: data.pickupCutoff ?? '', autoConfirmEnabled: !!data.autoConfirmEnabled, cancelOrderOnShipmentCancel: data.cancelOrderOnShipmentCancel !== false }))
  const [state, save] = useSave('orders', onSaved)
  const dirty = ORDER_RULES.some((r) => form[r.key] !== String(data[r.key])) || form.expressKeywords !== (data.expressKeywords ?? '') || form.pickupCutoff !== (data.pickupCutoff ?? '') || form.autoConfirmEnabled !== !!data.autoConfirmEnabled || form.cancelOrderOnShipmentCancel !== (data.cancelOrderOnShipmentCancel !== false)
  return (
    <form
      className="dash-card set-card"
      onSubmit={(e) => {
        e.preventDefault()
        save({ ...Object.fromEntries(ORDER_RULES.map((r) => [r.key, Number(form[r.key])])), expressKeywords: form.expressKeywords.trim(), pickupCutoff: form.pickupCutoff.trim(), autoConfirmEnabled: form.autoConfirmEnabled, cancelOrderOnShipmentCancel: form.cancelOrderOnShipmentCancel })
      }}
    >
      <h3 className="form-card-title">Quy tắc đơn hàng</h3>
      <div className="set-grid">
        {ORDER_RULES.map((r) => (
          <Field key={r.key} label={r.label} hint={r.hint}>
            <input className="dash-input" type="number" min="0" step="1" value={form[r.key]} onChange={(e) => setForm({ ...form, [r.key]: e.target.value })} />
          </Field>
        ))}
        <Field label="Tự xác nhận đơn hợp lệ" hint="Bật thì đơn hợp lệ không cần nhân viên bấm xác nhận từng đơn.">
          <select className="dash-select" value={form.autoConfirmEnabled ? '1' : '0'} onChange={(e) => setForm({ ...form, autoConfirmEnabled: e.target.value === '1' })}>
            <option value="1">Bật</option>
            <option value="0">Tắt</option>
          </select>
        </Field>
        <Field label="Hủy vận đơn trên Goship thì hủy luôn đơn hàng" hint="Bật: khi bạn hủy vận đơn ngay trên cổng Goship, đơn hàng trên website cũng tự hủy (chỉ đơn CHƯA thanh toán; đơn đã thanh toán giữ nguyên để nhân viên xử lý hoàn tiền). Tắt: đơn quay về Đang xử lý để tạo lại vận đơn. Hủy vận đơn bằng nút trên website không tự hủy đơn.">
          <select className="dash-select" value={form.cancelOrderOnShipmentCancel ? '1' : '0'} onChange={(e) => setForm({ ...form, cancelOrderOnShipmentCancel: e.target.value === '1' })}>
            <option value="1">Bật</option>
            <option value="0">Tắt</option>
          </select>
        </Field>
        <Field label="Giờ chốt đơn lấy hàng trong ngày (HH:MM)" hint="Hãng thường chỉ lấy trong ngày nếu đơn được chuẩn bị trước giờ này. Trang Đơn hàng hiện đếm ngược tới giờ chốt. Để trống nếu không dùng.">
          <input className="dash-input" placeholder="15:30" maxLength={5} value={form.pickupCutoff} onChange={(e) => setForm({ ...form, pickupCutoff: e.target.value })} />
        </Field>
        <Field label="Dịch vụ hỏa tốc nhận biết bằng từ khóa" hint='Phương án vận chuyển khách chọn có tên chứa một trong các từ này (cách nhau bằng dấu phẩy, không phân biệt hoa thường và dấu) thì đơn là hỏa tốc. Ví dụ: hỏa tốc, instant, trong ngày.'>
          <input className="dash-input" value={form.expressKeywords} maxLength={300} onChange={(e) => setForm({ ...form, expressKeywords: e.target.value })} />
        </Field>
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
              <span className="set-label">Xem thử mã QR khách sẽ thấy (đơn mẫu 100.000đ, mã 2611148M5W6ABM). Bạn quét thử bằng app ngân hàng để kiểm tra đúng tài khoản.</span>
              <TransferQr bank={m.bank} amount={100000} note={fillTransferNote(m.bank.transferNote, '2611148M5W6ABM')} />
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
  const goship = data.goship || { enabled: false, createShipments: false, defaultWeightGrams: 4000, origin: { province: '', district: '', ward: '', street: '', name: '', phone: '' } }
  const [form, setForm] = useState({ fee: String(data.fee), freeShippingOver: String(data.freeShippingOver) })
  const [gs, setGs] = useState({ enabled: goship.enabled, createShipments: Boolean(goship.createShipments), expressEnabled: Boolean(goship.expressEnabled), weight: String(goship.defaultWeightGrams), origin: { street: '', name: '', phone: '', lat: null, lng: null, ...goship.origin } })
  const [geo, setGeo] = useState({ busy: false, msg: '', error: '' })
  const coord = (v) => (v === null || v === undefined || v === '' ? '' : String(v))
  const [state, save] = useSave('shipping', onSaved)
  const num = (v) => (v === '' ? NaN : Number(v))
  const o = goship.origin
  const dirty =
    num(form.fee) !== data.fee ||
    num(form.freeShippingOver) !== data.freeShippingOver ||
    gs.enabled !== goship.enabled ||
    num(gs.weight) !== goship.defaultWeightGrams ||
    gs.origin.province !== o.province ||
    gs.origin.district !== o.district ||
    gs.origin.ward !== o.ward ||
    gs.createShipments !== Boolean(goship.createShipments) ||
    gs.expressEnabled !== Boolean(goship.expressEnabled) ||
    (gs.origin.lat ?? null) !== (o.lat ?? null) ||
    (gs.origin.lng ?? null) !== (o.lng ?? null) ||
    (gs.origin.street || '') !== (o.street || '') ||
    (gs.origin.name || '') !== (o.name || '') ||
    (gs.origin.phone || '') !== (o.phone || '')
  const digits = (k) => (e) => setForm({ ...form, [k]: e.target.value.replace(/[^\d]/g, '') })
  // Tìm tọa độ kho từ địa chỉ đã nhập (cần cho giao hỏa tốc); nhân viên nên mở bản đồ kiểm tra lại.
  async function findOriginCoords() {
    setGeo({ busy: true, msg: '', error: '' })
    try {
      const r = await api.post('/shipping/geocode', { addressLine: gs.origin.street, ward: gs.origin.ward, district: gs.origin.district, province: gs.origin.province })
      setGs((g) => ({ ...g, origin: { ...g.origin, lat: r.lat, lng: r.lng } }))
      setGeo({ busy: false, error: '', msg: r.level === 'address' ? 'Đã tìm được tọa độ theo địa chỉ. Hãy mở bản đồ kiểm tra.' : `Chỉ tìm được tới cấp ${r.level === 'ward' ? 'phường/xã' : 'quận/huyện'}, chưa đủ chính xác. Hãy mở bản đồ, chọn đúng vị trí kho và sao chép tọa độ vào.` })
    } catch (err) {
      setGeo({ busy: false, msg: '', error: err.message })
    }
  }
  return (
    <>
      <form
        className="dash-card set-card"
        onSubmit={(e) => {
          e.preventDefault()
          save({
            fee: num(form.fee),
            freeShippingOver: num(form.freeShippingOver),
            goship: { enabled: gs.enabled, createShipments: gs.createShipments, expressEnabled: gs.expressEnabled, defaultWeightGrams: num(gs.weight), origin: gs.origin },
          })
        }}
      >
        <h3 className="form-card-title">Phí vận chuyển</h3>
        <div className="set-grid">
          <Field label="Phí vận chuyển cố định (đ)" hint={num(form.fee) > 0 ? `${formatCurrency(num(form.fee))}, chỉ thu khi không tính được cước Goship` : Number.isFinite(num(form.fee)) ? '0: không thu phí cố định' : 'Nhập số'}>
            <input className="dash-input" inputMode="numeric" value={form.fee} onChange={digits('fee')} />
          </Field>
          <Field
            label="Miễn phí vận chuyển cho đơn từ (đ)"
            hint={num(form.freeShippingOver) > 0 ? `Đơn từ ${formatCurrency(num(form.freeShippingOver))} được miễn phí` : 'Nhập 0 nếu không miễn phí'}
          >
            <input className="dash-input" inputMode="numeric" value={form.freeShippingOver} onChange={digits('freeShippingOver')} />
          </Field>
        </div>

        <h3 className="form-card-title" style={{ marginTop: '24px' }}>Tính cước theo Goship</h3>
        <p className="set-hint">
          Bật thì ở trang thanh toán khách chọn đơn vị vận chuyển và trả đúng cước Goship báo. Goship lỗi hoặc địa chỉ không khớp thì dùng phí vận chuyển cố định ở trên (0 nghĩa là không thu).
          Cần có <code>GOSHIP_TOKEN</code> trong <code>backend/.env</code>.
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '12px 0', cursor: 'pointer' }}>
          <input type="checkbox" checked={gs.enabled} onChange={(e) => setGs({ ...gs, enabled: e.target.checked })} />
          Tính cước vận chuyển theo Goship
        </label>
        <div className="set-grid">
          <Field
            label="Cân nặng tính cước cho mỗi đơn (gram)"
            hint={Number.isFinite(num(gs.weight)) ? `${num(gs.weight) / 1000} kg, cố định cho cả đơn bất kể số lượng` : 'Nhập số'}
          >
            <input className="dash-input" inputMode="numeric" value={gs.weight} onChange={(e) => setGs({ ...gs, weight: e.target.value.replace(/[^\d]/g, '') })} />
          </Field>
        </div>
        <h4 style={{ margin: '16px 0 8px', fontSize: '13px' }}>Kho gửi hàng (điểm lấy hàng để tính cước)</h4>
        <div className="set-grid">
          <AddressFields value={gs.origin} onChange={(patch) => setGs((g) => ({ ...g, origin: { ...g.origin, ...patch } }))} Field={PlainField} inputClassName="dash-input" />
        </div>
        <div className="set-grid" style={{ marginTop: '12px' }}>
          <Field label="Địa chỉ kho (số nhà, đường)" hint="In trên vận đơn làm địa chỉ lấy hàng">
            <input className="dash-input" value={gs.origin.street || ''} onChange={(e) => setGs((g) => ({ ...g, origin: { ...g.origin, street: e.target.value } }))} maxLength={200} />
          </Field>
          <Field label="Tên người gửi" hint="Người shipper liên hệ khi lấy hàng">
            <input className="dash-input" value={gs.origin.name || ''} onChange={(e) => setGs((g) => ({ ...g, origin: { ...g.origin, name: e.target.value } }))} maxLength={100} />
          </Field>
          <Field label="Số điện thoại người gửi">
            <input className="dash-input" inputMode="tel" value={gs.origin.phone || ''} onChange={(e) => setGs((g) => ({ ...g, origin: { ...g.origin, phone: e.target.value } }))} maxLength={20} />
          </Field>
        </div>

        <h4 style={{ margin: '16px 0 8px', fontSize: '13px' }}>Tọa độ kho (cho giao hỏa tốc)</h4>
        <div className="set-grid">
          <Field label="Vĩ độ (lat)" hint="Ví dụ 10.8231">
            <input className="dash-input" inputMode="decimal" value={coord(gs.origin.lat)} onChange={(e) => setGs((g) => ({ ...g, origin: { ...g.origin, lat: e.target.value === '' ? null : Number(e.target.value.replace(',', '.')) } }))} />
          </Field>
          <Field label="Kinh độ (lng)" hint="Ví dụ 106.6297">
            <input className="dash-input" inputMode="decimal" value={coord(gs.origin.lng)} onChange={(e) => setGs((g) => ({ ...g, origin: { ...g.origin, lng: e.target.value === '' ? null : Number(e.target.value.replace(',', '.')) } }))} />
          </Field>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', margin: '8px 0' }}>
          <button type="button" className="set-save" disabled={geo.busy || !gs.origin.province} onClick={findOriginCoords}>{geo.busy ? 'Đang tìm…' : 'Tìm tọa độ từ địa chỉ kho'}</button>
          {gs.origin.lat != null && gs.origin.lng != null && (
            <a href={`https://www.google.com/maps?q=${gs.origin.lat},${gs.origin.lng}`} target="_blank" rel="noopener noreferrer">Mở bản đồ kiểm tra vị trí kho ↗</a>
          )}
          {geo.msg && <span className="set-ok">{geo.msg}</span>}
          {geo.error && <span className="set-error">{geo.error}</span>}
        </div>

        <h3 className="form-card-title" style={{ marginTop: '24px' }}>Giao hỏa tốc (Ahamove, Grab)</h3>
        <p className="set-hint">
          Bật thì khách <strong>cùng tỉnh/thành với kho</strong> thấy thêm phương án <strong>Hỏa tốc</strong> ở trang thanh toán (cước tính theo khoảng cách tới phường/xã của khách).
          Khi nhân viên bấm "Chuẩn bị hàng" cho đơn hỏa tốc, <strong>shipper được điều tới lấy hàng ngay</strong> (không đặt lịch hẹn được), nên hàng phải sẵn sàng trước.
          Cần nhập tọa độ kho ở trên, bật "Tạo vận đơn thật" ở dưới, và đăng ký webhook hỏa tốc trên Goship (cùng địa chỉ webhook vận đơn thường).
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '12px 0', cursor: 'pointer' }}>
          <input type="checkbox" checked={gs.expressEnabled} onChange={(e) => setGs({ ...gs, expressEnabled: e.target.checked })} />
          Bán giao hỏa tốc cho khách cùng tỉnh/thành
        </label>

        <h3 className="form-card-title" style={{ marginTop: '24px' }}>Tạo vận đơn thật qua Goship</h3>
        <p className="set-hint">
          Khi bật, trang chi tiết đơn có nút <strong>"Tạo vận đơn qua Goship"</strong>: gửi yêu cầu lấy hàng tới hãng và <strong>phát sinh cước thật</strong>.
          Mỗi lần tạo luôn có hộp xác nhận. Cần bật "Tính cước theo Goship" và nhập đủ thông tin kho, người gửi ở trên. Trạng thái giao hàng được cập nhật qua webhook
          (xem hướng dẫn ở trang Đơn vị vận chuyển).
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '12px 0', cursor: 'pointer' }}>
          <input type="checkbox" checked={gs.createShipments} onChange={(e) => setGs({ ...gs, createShipments: e.target.checked })} />
          Cho phép tạo vận đơn thật qua Goship
        </label>
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
      ) : tab === 'orders' ? (
        <OrdersTab data={settings.orders} onSaved={onSaved} />
      ) : tab === 'content' ? (
        <ContentTab data={settings.content} onSaved={onSaved} />
      ) : (
        <ShippingTab data={settings.shipping} onSaved={onSaved} />
      )}
    </AdminLayout>
  )
}
