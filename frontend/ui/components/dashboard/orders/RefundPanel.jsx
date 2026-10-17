'use client'

import { useState } from 'react'
import TransferQr from '../../TransferQr'
import { BANKS } from '../../../data/banks'
import { api } from '../../../api'
import { formatCurrency, formatDateTime } from '../../../utils/format'

// Hoàn tiền cho đơn đã thanh toán mà bị hủy / trả hàng. Hệ thống KHÔNG tự chuyển tiền: nhân viên quét mã QR (điền sẵn ngân hàng, số tài khoản,
// số tiền, nội dung) bằng app ngân hàng của shop để chuyển, rồi bấm "Hoàn tiền" ở đầu trang để ghi nhận. Sau khi hoàn, số tài khoản của khách được che.
export default function RefundPanel({ order, onChanged }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ bin: order.refundBankBin || '', account: '', holder: order.refundAccountName || '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (order.paymentStatus === 'REFUNDED') {
    return (
      <div className="dash-card" style={{ marginBottom: '24px' }}>
        <h3 className="form-card-title">Đã hoàn tiền</h3>
        <p style={{ fontSize: '13px', margin: 0 }}>
          {formatCurrency(order.total)}{order.refundedAt ? ` lúc ${formatDateTime(order.refundedAt)}` : ''}
          {order.refundAccountNumber ? ` · ${order.refundBankName || ''} ${order.refundAccountNumber}` : ''}
        </p>
      </div>
    )
  }
  if (order.paymentStatus !== 'PAID' || !['CANCELLED', 'RETURNED'].includes(order.status)) return null

  const hasInfo = Boolean(order.refundBankBin && order.refundAccountNumber)

  async function save(e) {
    e.preventDefault()
    const b = BANKS.find((x) => x.bin === form.bin)
    const acc = form.account.replace(/\s/g, '')
    if (!b) return setError('Chọn ngân hàng.')
    if (!/^\d{6,19}$/.test(acc)) return setError('Số tài khoản gồm 6 đến 19 chữ số.')
    if (!form.holder.trim()) return setError('Nhập tên chủ tài khoản.')
    setBusy(true)
    setError('')
    try {
      await api.patch(`/orders/${order.id}/refund-info`, { bankBin: b.bin, bankName: b.name, accountNumber: acc, accountName: form.holder.trim().toUpperCase() })
      setEditing(false)
      await onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dash-card" style={{ marginBottom: '24px', border: '1px solid var(--dash-warning, #d9ad3c)' }}>
      <h3 className="form-card-title">Cần hoàn tiền cho khách: {formatCurrency(order.total)}</h3>
      {hasInfo && !editing ? (
        <>
          <TransferQr
            bank={{ bankCode: order.refundBankBin, bankName: order.refundBankName, accountNumber: order.refundAccountNumber, accountHolder: order.refundAccountName }}
            amount={Number(order.total)}
            note={`Hoan tien don ${order.orderNumber}`}
            title="Quét mã bằng app ngân hàng của SHOP để chuyển hoàn tiền cho khách"
            footnote="Chuyển xong, bấm nút Hoàn tiền ở đầu trang để ghi nhận. Kiểm tra lại số tiền (đơn trả hàng có thể chỉ hoàn một phần)."
          />
          <button type="button" className="dash-btn dash-btn-ghost" style={{ marginTop: '10px' }} onClick={() => { setEditing(true); setForm({ bin: order.refundBankBin, account: order.refundAccountNumber, holder: order.refundAccountName || '' }) }}>Sửa tài khoản nhận</button>
        </>
      ) : (
        <form onSubmit={save} style={{ display: 'grid', gap: '10px', maxWidth: '420px' }}>
          {!hasInfo && <p style={{ fontSize: '13px', margin: 0 }}>Khách chưa nhập tài khoản nhận hoàn tiền. Hãy hỏi khách rồi nhập vào đây để tạo mã QR chuyển khoản.</p>}
          <select className="dash-select" value={form.bin} onChange={(e) => setForm({ ...form, bin: e.target.value })} aria-label="Ngân hàng">
            <option value="">— Chọn ngân hàng —</option>
            {BANKS.map((b) => <option key={b.bin} value={b.bin}>{b.name}</option>)}
          </select>
          <input className="dash-input" inputMode="numeric" placeholder="Số tài khoản" value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value.replace(/[^\d\s]/g, '') })} />
          <input className="dash-input" placeholder="Tên chủ tài khoản" value={form.holder} onChange={(e) => setForm({ ...form, holder: e.target.value })} />
          {error && <p style={{ color: 'var(--dash-danger)', fontSize: '13px', margin: 0 }} role="alert">{error}</p>}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="dash-btn" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu và tạo mã QR'}</button>
            {hasInfo && <button type="button" className="dash-btn dash-btn-ghost" onClick={() => setEditing(false)}>Hủy</button>}
          </div>
        </form>
      )}
    </div>
  )
}
