'use client'

import { useEffect, useState } from 'react'
import { useParams, Link } from '@/lib/router'
import TransferQr from '../components/TransferQr'
import { api } from '../api'
import { fillTransferNote } from '../utils/vietqr'

function readLastOrder(orderNumber) {
  try {
    return JSON.parse(sessionStorage.getItem(`clevinum_order_${orderNumber}`))
  } catch {
    return null
  }
}

export default function OrderConfirmation() {
  const { orderNumber } = useParams()
  const [info] = useState(() => readLastOrder(orderNumber))
  const [method, setMethod] = useState(null)

  // Đơn chuyển khoản: lấy thông tin ngân hàng hiện tại để hiện mã QR thanh toán.
  useEffect(() => {
    if (!info?.paymentMethod) return
    api
      .get('/shop/payment-options')
      .then((o) => setMethod(o.methods.find((m) => m.id === info.paymentMethod && m.bank) || null))
      .catch(() => setMethod(null))
  }, [info])

  const canPayByQr = method?.bank?.bankCode && method.bank.accountNumber && info?.total > 0

  return (
    <>
      <main>
        <div className="container order-confirmation">
          <div className="order-confirmation-icon">✓</div>
          <h1>Đặt hàng thành công!</h1>
          <p>
            Cảm ơn bạn đã đặt hàng tại Clevinum. Mã đơn hàng của bạn là <strong>{orderNumber}</strong>.
            Đội ngũ CSKH sẽ liên hệ xác nhận trong thời gian sớm nhất.
          </p>
          {info?.paymentMethod === 'PAYOS' && (
            <p>
              Nếu bạn đã thanh toán, đơn hàng sẽ tự động được xác nhận trong ít phút. Bạn có thể theo dõi trạng thái ở nút
              “Theo dõi đơn hàng” bên dưới.
            </p>
          )}
          {canPayByQr && (
            <div className="order-confirmation-qr">
              <h3>Thanh toán đơn hàng bằng chuyển khoản</h3>
              <TransferQr
                bank={method.bank}
                amount={info.total}
                note={fillTransferNote(method.bank.transferNote, orderNumber)}
                footnote="Nội dung chuyển khoản có mã đơn hàng để shop xác nhận thanh toán nhanh. Vui lòng không sửa nội dung."
              />
            </div>
          )}
          <div className="order-confirmation-actions">
            <Link to={`/track-order?orderNumber=${encodeURIComponent(orderNumber)}`} className="btn btn-accent">
              Theo dõi đơn hàng
            </Link>
            <Link to="/products" className="btn btn-hero">
              Tiếp tục mua sắm
            </Link>
            <Link to="/" className="btn btn-hero">
              Về trang chủ
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
