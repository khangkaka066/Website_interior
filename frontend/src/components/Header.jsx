import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { shopInfo } from '../data/shop'
import { getSession, logout } from '../auth'
import { useCart } from '../context/CartContext'

function formatPrice(n) {
  return n.toLocaleString('vi-VN') + 'đ'
}

export default function Header() {
  const [session, setSession] = useState(() => getSession())
  const navigate = useNavigate()
  const { totalCount, totalPrice } = useCart()

  function handleLogout() {
    logout()
    setSession(null)
    navigate('/')
  }

  return (
    <header className="header">
      <div className="container header-top">
        <div className="logo">
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
            <path
              d="M4 3 C4 10 9 12 9 16 C9 20 5 21 5 23"
              stroke="var(--accent)"
              strokeWidth="2"
              fill="none"
            />
            <path
              d="M22 3 C22 10 17 12 17 16 C17 20 21 21 21 23"
              stroke="var(--accent)"
              strokeWidth="2"
              fill="none"
            />
          </svg>
          <span className="logo-text">{shopInfo.name}</span>
        </div>

        <div className="search-bar">
          <input type="text" placeholder="Tìm rèm bạn cần..." />
          <button aria-label="Tìm kiếm">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5.2" stroke="white" strokeWidth="1.6" />
              <line x1="11" y1="11" x2="15" y2="15" stroke="white" strokeWidth="1.6" />
            </svg>
          </button>
        </div>

        <div className="header-actions">
          <div className="support">
            <span className="headset-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 13a8 8 0 0 1 16 0"
                  stroke="var(--accent)"
                  strokeWidth="1.8"
                  fill="none"
                />
                <rect x="3" y="13" width="4" height="6" rx="2" fill="var(--accent)" />
                <rect x="17" y="13" width="4" height="6" rx="2" fill="var(--accent)" />
              </svg>
            </span>
            <div className="support-text">
              <span>Hotline CSKH</span>
              <strong>{shopInfo.hotline}</strong>
            </div>
          </div>
          {session ? (
            <div className="account-menu">
              <span className="account-greeting">Xin chào, {session.name}</span>
              {session.role === 'ADMIN' && (
                <Link to="/dashboard" className="account-admin-link">
                  Quản trị
                </Link>
              )}
              <button className="account-logout" onClick={handleLogout}>
                Đăng xuất
              </button>
            </div>
          ) : (
            <IconButton label="Đăng nhập" to="/login">
              <path
                d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c1.2-4 4-6 7-6s5.8 2 7 6"
                stroke="currentColor"
                strokeWidth="1.6"
                fill="none"
              />
            </IconButton>
          )}
          <IconButton label="Yêu thích">
            <path
              d="M12 20s-7-4.35-9.3-8.8C1.2 8 3 5 6.3 5c2 0 3.4 1.1 4.2 2.4C11.3 6.1 12.7 5 14.7 5 18 5 19.8 8 18.3 11.2 16 15.65 12 20 12 20Z"
              stroke="currentColor"
              strokeWidth="1.4"
              fill="none"
            />
          </IconButton>
          <Link to="/cart" className="cart">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 4h2l2 12h11l2-8H7"
                stroke="currentColor"
                strokeWidth="1.6"
                fill="none"
              />
              <circle cx="9" cy="20" r="1.4" fill="currentColor" />
              <circle cx="17" cy="20" r="1.4" fill="currentColor" />
            </svg>
            <span>Giỏ hàng {totalCount > 0 ? `(${totalCount}) ${formatPrice(totalPrice)}` : '0đ'}</span>
          </Link>
        </div>
      </div>

      <div className="header-bottom">
        <div className="container header-bottom-inner">
          <nav className="main-nav">
            <Link to="/">Trang chủ</Link>
            <Link to="/products">Sản phẩm</Link>
            <Link to="/products?category=dan-tuong">Rèm Dán Tường</Link>
            <Link to="/products?category=chong-nang">
              Rèm Cửa Chống Nắng <span className="badge badge-green">MỚI</span>
            </Link>
            <Link to="/products?category=voan-lua">Rèm Voan Lụa</Link>
            <Link to="/products?category=thanh-treo">Thanh Treo Rèm</Link>
          </nav>
          <a className="best-offer" href="/#deal">
            % ƯU ĐÃI HÔM NAY
          </a>
        </div>
      </div>
    </header>
  )
}

function IconButton({ label, children, to }) {
  const content = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      {children}
    </svg>
  )

  if (to) {
    return (
      <Link className="icon-btn" to={to} aria-label={label}>
        {content}
      </Link>
    )
  }

  return (
    <button className="icon-btn" aria-label={label}>
      {content}
    </button>
  )
}
