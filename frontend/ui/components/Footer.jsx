'use client'

import { useState } from 'react'
import { Link } from '@/lib/router'
import { api } from '../api'
import { categories } from '../data/shop'
import { useShopInfo } from '../useShopInfo'

export default function Footer() {
  const { shopInfo } = useShopInfo()
  const [email, setEmail] = useState('')
  const [state, setState] = useState({ status: 'idle', message: '' }) // idle | busy | ok | error

  async function subscribe(e) {
    e.preventDefault()
    setState({ status: 'busy', message: '' })
    try {
      await api.post('/shop/subscribe', { email })
      setEmail('')
      setState({ status: 'ok', message: 'Cảm ơn bạn! Chúng tôi sẽ gửi ưu đãi mới qua email.' })
    } catch (err) {
      setState({ status: 'error', message: err.message })
    }
  }

  return (
    <footer className="footer">
      <div className="container">
        <div className="newsletter">
          <span className="newsletter-icon" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></svg>
          </span>
          <h3>Đăng ký nhận ưu đãi</h3>
          <p>Nhận thông tin khuyến mãi mới nhất và mã giảm giá qua email.</p>
          <form className="newsletter-form" onSubmit={subscribe}>
            <input type="email" required placeholder="Nhập email của bạn..." value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email của bạn" />
            <button className="btn-pill btn-pill-dark" disabled={state.status === 'busy'}>{state.status === 'busy' ? 'Đang gửi…' : 'Đăng ký'}</button>
          </form>
          {state.message && <p className={`newsletter-msg newsletter-${state.status}`} role={state.status === 'error' ? 'alert' : 'status'}>{state.message}</p>}
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
          {/* /about, /contact, /faq do app Next (frontend/) phục vụ nên dùng <a> tải trang đầy đủ, không dùng <Link> */}
          <a href="/about">Về chúng tôi</a>
          <a href="/contact">Liên hệ</a>
          <a href="/faq">FAQ</a>
          <a href="/privacy">Chính sách bảo mật</a>
          <a href="/terms">Điều khoản sử dụng</a>
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
