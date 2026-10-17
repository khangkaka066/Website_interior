'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '../../../api'
import DeliveryBadge from '../../DeliveryBadge'
import PickupMethod, { usePickupMethod, PICKUP_LABEL } from './PickupMethod'

function money(n) {
  return Number(n || 0).toLocaleString('vi-VN') + 'đ'
}

// Tạo vận đơn THẬT qua Goship: phát sinh cước. Hỏi cước ngay lúc mở (mã lựa chọn chỉ có hiệu lực ngắn), admin chọn hãng,
// tích xác nhận rồi mới bấm tạo. Máy chủ hỏi lại cước lần nữa và từ chối nếu giá/hãng đã đổi.
export default function GoshipShipmentModal({ order, onClose, onCreated, onManual }) {
  const [state, setState] = useState({ loading: true, options: [], error: '', code: '' })
  const [rateId, setRateId] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [pickup, setPickup] = usePickupMethod()
  // Hỏa tốc: tọa độ điểm giao nhân viên nhập tay (thay cho tọa độ tự tra), và xác nhận đã kiểm tra vị trí trên bản đồ.
  const [manual, setManual] = useState({ lat: '', lng: '', active: null })
  const [locationOk, setLocationOk] = useState(false)

  const load = useCallback(async (override) => {
    setState((s) => ({ ...s, loading: true, error: '' }))
    setError('')
    try {
      const q = override ? `?dropLat=${override.lat}&dropLng=${override.lng}` : ''
      const data = await api.get(`/shipping/goship/orders/${order.id}/rates${q}`)
      setState({ loading: false, options: data.options, weightGrams: data.weightGrams, cod: data.cod, customerChoice: data.customerChoice, express: !!data.express, drop: data.drop, error: '', code: '' })
      // Mặc định phương án rẻ nhất cùng loại với đơn: đơn hỏa tốc chọn dịch vụ hỏa tốc, đơn thường tránh dịch vụ hỏa tốc đắt hơn (danh sách đã xếp rẻ trước).
      // Khách đã chọn hãng nào lúc đặt hàng thì ưu tiên đúng hãng + gói đó.
      const wantExpress = order.deliveryType === 'EXPRESS'
      const sameKind = data.options.filter((o) => !!o.express === wantExpress)
      setRateId((sameKind.find((o) => o.preferred) || sameKind[0] || (wantExpress ? null : data.options[0]))?.id || '')
    } catch (err) {
      setState({ loading: false, options: [], error: err.message, code: err.data?.code || '' })
    }
  }, [order.id, order.deliveryType])

  useEffect(() => {
    load()
  }, [load])

  const exact = !state.express || ['manual', 'saved', 'address'].includes(state.drop?.level)
  const applyManual = () => {
    const lat = Number(String(manual.lat).replace(',', '.'))
    const lng = Number(String(manual.lng).replace(',', '.'))
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return setError('Nhập vĩ độ và kinh độ hợp lệ (ví dụ 10.7769 và 106.7009).')
    setManual((m) => ({ ...m, active: { lat, lng } }))
    setLocationOk(false)
    load({ lat, lng })
  }

  const picked = state.options.find((o) => o.id === rateId)

  async function handleCreate() {
    if (!picked || !confirmed || (state.express && !exact && !locationOk)) return
    setSubmitting(true)
    setError('')
    try {
      const shipment = await api.post(`/shipping/goship/orders/${order.id}/shipment`, { rateId: picked.id, confirm: true, pickupMethod: pickup, ...(state.express ? { dropConfirmed: locationOk, ...(manual.active ? { dropLat: manual.active.lat, dropLng: manual.active.lng } : {}) } : {}) })
      onCreated(shipment)
    } catch (err) {
      setSubmitting(false)
      if (err.data?.code === 'RATE_CHANGED') {
        setConfirmed(false)
        await load() // cước vừa đổi: tải lại để chọn đúng, rồi mới hiện thông báo (tải lại sẽ xóa lỗi cũ)
      }
      setError(err.message)
    }
  }

  return (
    <div className="dash-modal-overlay" onClick={submitting ? undefined : onClose}>
      <div className="dash-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dash-modal-head">
          <h3>Chuẩn bị hàng — {order.orderNumber}</h3>
          <button className="dash-modal-close" onClick={onClose} disabled={submitting}>✕</button>
        </div>

        <div className="dash-form-grid">
          <div className="dash-form-field full">
            <label>Người nhận</label>
            <input value={`${order.recipientName} — ${order.recipientPhone}`} disabled />
          </div>
          <div className="dash-form-field full">
            <label>Địa chỉ nhận</label>
            <input value={[order.addressLine, order.ward, order.district, order.province].filter(Boolean).join(', ')} disabled />
          </div>
        </div>

        <h4 style={{ margin: '16px 0 8px', fontSize: '13px' }}>Chọn đơn vị vận chuyển</h4>
        {state.loading ? (
          <p style={{ fontSize: '13px', color: 'var(--dash-muted)' }}>Đang lấy cước từ Goship…</p>
        ) : state.error ? (
          <div style={{ fontSize: '13px', color: 'var(--dash-danger)' }}>
            <p style={{ marginBottom: '8px' }}>{state.error}</p>
            <button className="dash-btn dash-btn-ghost" onClick={load}>Thử lại</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {state.options.map((o) => (
              <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: `1px solid ${rateId === o.id ? 'var(--dash-accent, #946b08)' : 'var(--dash-border)'}`, cursor: 'pointer' }}>
                <input type="radio" name="goship-rate" checked={rateId === o.id} onChange={() => setRateId(o.id)} />
                <span style={{ flex: 1 }}>
                  <strong>{o.carrier}{o.service ? ` – ${o.service}` : ''}</strong> {o.express && <DeliveryBadge type="EXPRESS" />}{o.preferred && <span className="dt-badge dt-intracity" style={{ marginLeft: '6px' }}>Khách đã chọn</span>}
                  {o.expected && <small style={{ display: 'block', color: 'var(--dash-muted)' }}>{o.expected}</small>}
                </span>
                <strong>{money(o.originalFee ?? o.fee)}</strong>
              </label>
            ))}
            {state.customerChoice && (
              <p style={{ fontSize: '12px', margin: 0 }}>
                Khách chọn <strong>{state.customerChoice.carrier}{state.customerChoice.service ? ` – ${state.customerChoice.service}` : ''}</strong> và đã trả phí vận chuyển <strong>{money(state.customerChoice.fee)}</strong>.
                {!state.options.some((o) => o.preferred) && <span style={{ color: 'var(--dash-danger)' }}> Phương án này hiện không còn, hãy chọn hãng khác tương đương.</span>}
              </p>
            )}
            {order.deliveryType === 'EXPRESS' && !state.options.some((o) => o.express) && (
              <p style={{ fontSize: '12px', color: 'var(--dash-danger)', margin: 0 }}>Khách đặt giao HỎA TỐC nhưng Goship hiện không có dịch vụ hỏa tốc cho tuyến này. Hãy liên hệ khách hoặc chọn dịch vụ khác.</p>
            )}
            <p style={{ fontSize: '12px', color: 'var(--dash-muted)', margin: 0 }}>
              Cân nặng tính cước {state.weightGrams}g. Thu hộ COD: {money(state.cod)}. Cước hiển thị là cước shop trả cho Goship, khách đã trả phí vận chuyển trong tổng đơn.
            </p>
          </div>
        )}

        {state.express && (
          <div style={{ marginTop: '12px', padding: '10px 12px', background: 'var(--dash-warn-bg, #fff4e5)', fontSize: '13px' }}>
            <strong>Đơn HỎA TỐC.</strong> Ngay khi bấm tạo, Goship điều <strong>shipper xe máy tới lấy hàng ngay</strong> (không hẹn giờ được). Hãy chắc chắn hàng đã nhặt và đóng gói xong, người nhận đã sẵn sàng.
          </div>
        )}
        {state.express && state.drop && (
          <div style={{ marginTop: '12px', fontSize: '13px' }}>
            <div>
              <strong>Điểm giao (tọa độ):</strong> {Number(state.drop.lat).toFixed(5)}, {Number(state.drop.lng).toFixed(5)} ·{' '}
              {state.drop.level === 'manual' ? 'do nhân viên nhập' : state.drop.level === 'saved' ? 'đã kiểm tra trước đó' : state.drop.level === 'address' ? 'tra theo địa chỉ có số nhà' : state.drop.level === 'ward' ? 'CHỈ tới cấp phường/xã' : 'CHỈ tới cấp quận/huyện'}{' '}
              <a href={`https://www.google.com/maps?q=${state.drop.lat},${state.drop.lng}`} target="_blank" rel="noopener noreferrer">Mở bản đồ kiểm tra ↗</a>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px' }}>
              <span>Sai vị trí? Nhập tọa độ đúng:</span>
              <input className="dash-input" style={{ width: '120px' }} placeholder="Vĩ độ" value={manual.lat} onChange={(e) => setManual({ ...manual, lat: e.target.value })} />
              <input className="dash-input" style={{ width: '120px' }} placeholder="Kinh độ" value={manual.lng} onChange={(e) => setManual({ ...manual, lng: e.target.value })} />
              <button type="button" className="dash-btn dash-btn-ghost" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={applyManual} disabled={submitting}>Dùng tọa độ này</button>
            </div>
            {!exact && (
              <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginTop: '10px', color: 'var(--dash-danger, #c0392b)', cursor: 'pointer' }}>
                <input type="checkbox" checked={locationOk} onChange={(e) => setLocationOk(e.target.checked)} style={{ marginTop: '3px' }} />
                <span>Vị trí mới tìm được tới cấp phường/quận nên có thể lệch. Tôi đã kiểm tra trên bản đồ (hoặc nhập tọa độ chính xác) và xác nhận điều shipper tới đúng nơi.</span>
              </label>
            )}
          </div>
        )}
        {!state.loading && !state.error && !state.express && <PickupMethod value={pickup} onChange={setPickup} disabled={submitting} />}

        {picked && (
          <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginTop: '16px', padding: '10px 12px', background: 'var(--dash-warn-bg, #fff4e5)', fontSize: '13px', cursor: 'pointer' }}>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} style={{ marginTop: '3px' }} />
            <span>
              Tôi hiểu đây là <strong>vận đơn thật</strong> qua <strong>{picked.carrier}</strong>, cước khoảng <strong>{money(picked.originalFee ?? picked.fee)}</strong> do shop trả. {state.express ? <>Shipper được điều tới lấy <strong>ngay</strong>.</> : <>Cách giao hàng: <strong>{PICKUP_LABEL[pickup]}</strong>.</>}
              Chỉ hủy được khi hãng chưa lấy hàng.
            </span>
          </label>
        )}

        {error && <p style={{ color: 'var(--dash-danger)', fontSize: '13px', marginTop: '12px' }}>{error}</p>}

        <div className="dash-modal-actions">
          {onManual && (
            <button className="dash-btn dash-btn-ghost" onClick={onManual} disabled={submitting} style={{ marginRight: 'auto' }}>
              Tạo thủ công (không qua Goship)
            </button>
          )}
          <button className="dash-btn dash-btn-ghost" onClick={onClose} disabled={submitting}>Hủy</button>
          <button className="dash-btn" onClick={handleCreate} disabled={!picked || !confirmed || submitting || (state.express && !exact && !locationOk)}>
            {submitting ? 'Đang chuẩn bị…' : state.express ? 'Điều shipper và in tem' : 'Chuẩn bị hàng và in tem'}
          </button>
        </div>
      </div>
    </div>
  )
}
