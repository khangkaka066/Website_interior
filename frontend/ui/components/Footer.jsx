'use client'

import { Link } from '@/lib/router'
import { categories } from '../data/shop'
import { useShopInfo } from '../useShopInfo'

export default function Footer() {
  const { shopInfo } = useShopInfo()
  return (
    <footer className="footer">
      <div className="container newsletter">
        <div className="newsletter-icon">✉</div>
        <div>
          <h3>Đăng ký nhận ưu đãi</h3>
          <p>Nhận thông tin khuyến mãi mới nhất & giảm 10% cho đơn đầu tiên</p>
        </div>
        <div className="newsletter-form">
          <input type="email" placeholder="Nhập email của bạn" />
          <button className="btn btn-accent">ĐĂNG KÝ</button>
        </div>
      </div>

      <div className="container footer-columns">
        <div className="footer-brand">
          <span className="logo-text">{shopInfo.name}</span>
          <p>
            {shopInfo.tagline} — rèm cửa chất lượng cao, giá xưởng, giao hàng toàn quốc.
          </p>
        </div>
        <div className="footer-col">
          <h4>Tài khoản</h4>
          {/* /about, /contact, /faq do app Next (web/) phục vụ nên dùng <a> tải trang đầy đủ, không dùng <Link> */}
          <a href="/about">Về chúng tôi</a>
          <a href="/contact">Liên hệ</a>
          <a href="/faq">FAQ</a>
          <Link to="/cart">Giỏ hàng</Link>
          <Link to="/track-order">Tra cứu đơn hàng</Link>
        </div>
        <div className="footer-col">
          <h4>Danh mục</h4>
          {categories.map((c) => (
            <Link key={c.id} to={`/products?category=${c.id}`}>
              {c.name}
            </Link>
          ))}
        </div>
        <div className="footer-col">
          <h4>Liên hệ</h4>
          <span>{shopInfo.address}</span>
          <a href={`tel:${String(shopInfo.hotline).replace(/[^\d+]/g, '')}`}>Hotline: {shopInfo.hotline}</a>
          {shopInfo.email && <a href={`mailto:${shopInfo.email}`}>Email: {shopInfo.email}</a>}
        </div>
      </div>

      <div className="container footer-bottom">
        <span>© 2026 {shopInfo.name}. All rights reserved.</span>
        <div className="payment-icons">
          <span>VISA</span>
          <span>MASTERCARD</span>
          <span>MOMO</span>
          <span>COD</span>
          <Link to="/dashboard" className="admin-link">
            Quản trị
          </Link>
        </div>
      </div>
    </footer>
  )
}
