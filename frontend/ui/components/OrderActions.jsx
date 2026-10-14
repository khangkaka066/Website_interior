'use client'

import { useState } from 'react'
import { api } from '../api'
import { formatDateTime } from '../utils/format'
import '../styles/order-actions.css'

// Việc khách tự làm với đơn của mình (kiểu Shopee): hủy / yêu cầu hủy, đã nhận hàng, trả hàng, đánh giá.
// owner: { account: true } khi đã đăng nhập, hoặc { phone } khi tra cứu bằng mã đơn + số điện thoại. Máy chủ quyết định việc nào được phép (order.actions).
const CANCEL_REASONS = ['Muốn thay đổi địa chỉ giao hàng', 'Muốn đổi sản phẩm / phân loại', 'Tìm được giá tốt hơn', 'Đặt nhầm / không còn nhu cầu', 'Khác']
const RETURN_REASONS = ['Hàng bị lỗi / hư hỏng', 'Sai sản phẩm / màu / kích thước', 'Hàng không giống mô tả', 'Thiếu hàng / thiếu phụ kiện', 'Khác']
const RETURN_STATUS = {
  REQUESTED: 'Yêu cầu trả hàng đã gửi, shop sẽ phản hồi sớm.',
  APPROVED: 'Shop đã đồng ý yêu cầu trả hàng. Nhân viên sẽ liên hệ hướng dẫn gửi hàng và hoàn tiền.',
  REJECTED: 'Shop đã từ chối yêu cầu trả hàng.',
}

function Stars({ value, onChange, label }) {
  return (
    <span className="oa-stars" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} sao`} className={n <= value ? 'on' : ''} onClick={() => onChange(n)}>
          ★
        </button>
      ))}
    </span>
  )
}

export function StaticStars({ value }) {
  return <span className="oa-stars-static" aria-label={`${value} trên 5 sao`}>{'★'.repeat(value)}{'☆'.repeat(5 - value)}</span>
}

export default function OrderActions({ order, owner, onChange }) {
  const [panel, setPanel] = useState(null) // 'cancel' | 'return' | 'review'
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [ratings, setRatings] = useState({}) // orderItemId -> { rating, comment }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const a = order.actions || {}

  const open = (p) => {
    setPanel(p)
    setReason('')
    setNote('')
    setError('')
  }

  async function call(action, body) {
    setBusy(true)
    setError('')
    try {
      const res = owner.account
        ? await api.post(`/account/orders/${encodeURIComponent(order.orderNumber)}/${action}`, body)
        : await api.post(`/orders/self/${action}`, { orderNumber: order.orderNumber, phone: owner.phone, ...body })
      setPanel(null)
      onChange(res.order)
      return res
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const reasonText = () => (reason === 'Khác' ? note.trim() : [reason, note.trim()].filter(Boolean).join(' - '))
  const needReason = () => {
    if (!reason || (reason === 'Khác' && !note.trim())) {
      setError('Vui lòng chọn hoặc nhập lý do.')
      return true
    }
    return false
  }

  function submitReviews() {
    const entries = order.items
      .filter((i) => ratings[i.id]?.rating)
      .map((i) => ({ orderItemId: i.id, rating: ratings[i.id].rating, comment: ratings[i.id].comment?.trim() || undefined }))
    if (!entries.length) return setError('Hãy chọn số sao cho ít nhất một sản phẩm.')
    call('reviews', { reviews: entries })
  }

  const unreviewed = order.items.filter((i) => i.productId && !i.review)
  const hasButtons = a.cancel || a.received || a.return || a.review

  return (
    <div className="oa">
      {order.cancelRequest?.pending && (
        <p className="oa-note">
          Bạn đã gửi yêu cầu hủy đơn{order.cancelRequest.reason ? ` (${order.cancelRequest.reason})` : ''}. Shop sẽ phản hồi sớm.
          {order.cancelRequest.autoApproveAt ? ` Nếu shop chưa phản hồi, yêu cầu sẽ tự được đồng ý lúc ${formatDateTime(order.cancelRequest.autoApproveAt)}.` : ''}
        </p>
      )}
      {!order.cancelRequest?.pending && order.cancelRequest?.rejectedNote && <p className="oa-note">Shop chưa thể hủy đơn này: {order.cancelRequest.rejectedNote}</p>}
      {order.receivedAt && <p className="oa-note">Bạn đã xác nhận nhận hàng lúc {formatDateTime(order.receivedAt)}.</p>}
      {order.returnRequest && (
        <p className="oa-note">
          {RETURN_STATUS[order.returnRequest.status]}
          {order.returnRequest.adminNote ? ` Phản hồi của shop: ${order.returnRequest.adminNote}` : ''}
        </p>
      )}

      {hasButtons && !panel && (
        <div className="oa-buttons">
          {a.received && (
            <button type="button" className="btn btn-accent" disabled={busy} onClick={() => call('received', {})}>Đã nhận được hàng</button>
          )}
          {a.review && unreviewed.length > 0 && (
            <button type="button" className="btn btn-accent" onClick={() => open('review')}>Đánh giá sản phẩm</button>
          )}
          {a.cancel && (
            <button type="button" className="btn btn-outline" onClick={() => open('cancel')}>{a.cancel === 'now' ? 'Hủy đơn hàng' : 'Yêu cầu hủy đơn'}</button>
          )}
          {a.return && <button type="button" className="btn btn-outline" onClick={() => open('return')}>Trả hàng / Hoàn tiền</button>}
        </div>
      )}
      {error && !panel && <p className="oa-error">{error}</p>}

      {(panel === 'cancel' || panel === 'return') && (
        <form
          className="oa-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (needReason()) return
            if (panel === 'cancel') call('cancel', { reason: reasonText() })
            else call('return', { reason: reasonText().slice(0, 300) })
          }}
        >
          <h4>{panel === 'cancel' ? (a.cancel === 'now' ? 'Hủy đơn hàng' : 'Yêu cầu hủy đơn') : 'Yêu cầu trả hàng / hoàn tiền'}</h4>
          {panel === 'cancel' && (
            <p className="oa-hint">
              {a.cancel === 'now'
                ? 'Đơn sẽ được hủy ngay. Nếu đã thanh toán, shop sẽ liên hệ hoàn tiền.'
                : 'Shop đã xác nhận đơn nên cần nhân viên đồng ý; nếu shop chưa phản hồi trong thời gian quy định, yêu cầu sẽ tự được đồng ý. Bạn sẽ thấy kết quả ngay trên trang này.'}
            </p>
          )}
          <label>
            Lý do
            <select value={reason} onChange={(e) => { setReason(e.target.value); setError('') }}>
              <option value="">— Chọn lý do —</option>
              {(panel === 'cancel' ? CANCEL_REASONS : RETURN_REASONS).map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          <label>
            {reason === 'Khác' ? 'Nhập lý do' : 'Ghi chú thêm (không bắt buộc)'}
            <textarea value={note} maxLength={300} rows={3} onChange={(e) => { setNote(e.target.value); setError('') }} />
          </label>
          {error && <p className="oa-error">{error}</p>}
          <div className="oa-buttons">
            <button type="submit" className="btn btn-accent" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi'}</button>
            <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setPanel(null)}>Đóng</button>
          </div>
        </form>
      )}

      {panel === 'review' && (
        <div className="oa-form">
          <h4>Đánh giá sản phẩm</h4>
          {unreviewed.map((i) => (
            <div key={i.id} className="oa-review-item">
              <div className="oa-review-name">{i.name}{i.variant ? ` · ${i.variant}` : ''}</div>
              <Stars label={`Số sao cho ${i.name}`} value={ratings[i.id]?.rating || 0} onChange={(n) => setRatings({ ...ratings, [i.id]: { ...ratings[i.id], rating: n } })} />
              <textarea
                rows={2}
                maxLength={1000}
                placeholder="Chia sẻ cảm nhận của bạn về sản phẩm (không bắt buộc)"
                value={ratings[i.id]?.comment || ''}
                onChange={(e) => setRatings({ ...ratings, [i.id]: { ...ratings[i.id], comment: e.target.value } })}
              />
            </div>
          ))}
          {error && <p className="oa-error">{error}</p>}
          <div className="oa-buttons">
            <button type="button" className="btn btn-accent" disabled={busy} onClick={submitReviews}>{busy ? 'Đang gửi…' : 'Gửi đánh giá'}</button>
            <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setPanel(null)}>Đóng</button>
          </div>
        </div>
      )}
    </div>
  )
}
