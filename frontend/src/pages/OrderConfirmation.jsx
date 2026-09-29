import { useParams, Link } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'

export default function OrderConfirmation() {
  const { orderNumber } = useParams()

  return (
    <>
      <Header />
      <main>
        <div className="container order-confirmation">
          <div className="order-confirmation-icon">✓</div>
          <h1>Đặt hàng thành công!</h1>
          <p>
            Cảm ơn bạn đã đặt hàng tại Clevinum. Mã đơn hàng của bạn là <strong>{orderNumber}</strong>.
            Đội ngũ CSKH sẽ liên hệ xác nhận trong thời gian sớm nhất.
          </p>
          <div className="order-confirmation-actions">
            <Link to="/products" className="btn btn-accent">
              Tiếp tục mua sắm
            </Link>
            <Link to="/" className="btn btn-hero">
              Về trang chủ
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
