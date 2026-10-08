import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { buildVietQrPayload, sanitizeTransferNote } from '../utils/vietqr'

const money = (n) => Number(n || 0).toLocaleString('vi-VN') + 'đ'

function CopyButton({ text, label }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className="tqr-copy"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        })
      }}
      aria-label={`Sao chép ${label}`}
    >
      {done ? 'Đã chép' : 'Sao chép'}
    </button>
  )
}

// Mã QR VietQR + thông tin chuyển khoản. `note` là nội dung chuyển khoản đã điền sẵn.
export default function TransferQr({ bank, amount, note, footnote }) {
  const [src, setSrc] = useState('')
  const content = sanitizeTransferNote(note)
  const payload = buildVietQrPayload({ bin: bank?.bankCode, account: bank?.accountNumber, amount, content })

  useEffect(() => {
    let cancelled = false
    if (!payload) {
      setSrc('')
      return
    }
    QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 2, width: 280 })
      .then((url) => !cancelled && setSrc(url))
      .catch(() => !cancelled && setSrc(''))
    return () => {
      cancelled = true
    }
  }, [payload])

  return (
    <div className="tqr">
      {src ? (
        <img className="tqr-img" src={src} alt="Mã QR chuyển khoản" width="200" height="200" />
      ) : (
        payload === null && <p className="tqr-miss">Chưa có đủ thông tin ngân hàng để tạo mã QR.</p>
      )}
      <div className="tqr-info">
        <p className="tqr-title">Quét mã bằng app ngân hàng để thanh toán</p>
        {bank?.bankName && <div>Ngân hàng: <strong>{bank.bankName}</strong></div>}
        {bank?.accountNumber && (
          <div>
            Số tài khoản: <strong>{bank.accountNumber}</strong> <CopyButton text={bank.accountNumber} label="số tài khoản" />
          </div>
        )}
        {bank?.accountHolder && <div>Chủ tài khoản: <strong>{bank.accountHolder}</strong></div>}
        {Number(amount) > 0 && <div>Số tiền: <strong>{money(amount)}</strong></div>}
        {content && (
          <div>
            Nội dung: <strong>{content}</strong> <CopyButton text={content} label="nội dung chuyển khoản" />
          </div>
        )}
        {footnote && <p className="tqr-foot">{footnote}</p>}
      </div>
    </div>
  )
}
