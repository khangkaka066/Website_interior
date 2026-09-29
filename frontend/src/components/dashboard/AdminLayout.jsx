import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { shopInfo } from '../../data/shop'
import { getSession, logout } from '../../auth'
import { api } from '../../api'

const NAV_ITEMS = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'products', label: 'Sản phẩm' },
  { id: 'orders', label: 'Đơn hàng' },
  { id: 'customers', label: 'Khách hàng' },
  { id: 'shipping', label: 'Vận chuyển' },
  { id: 'messages', label: 'Tin nhắn' },
  { id: 'campaigns', label: 'Quảng cáo' },
  { id: 'analytics', label: 'Phân tích' },
  { id: 'settings', label: 'Cài đặt' },
]

const UNREAD_POLL_MS = 10000

export default function AdminLayout({ activeNav, pageTitle, headerActions, children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const session = getSession()

  const getActiveNav = () => {
    if (location.pathname === '/dashboard') return 'overview'
    if (location.pathname.startsWith('/dashboard/products')) return 'products'
    if (location.pathname.startsWith('/dashboard/orders')) return 'orders'
    if (location.pathname.startsWith('/dashboard/shipping')) return 'shipping'
    if (location.pathname.startsWith('/dashboard/customers')) return 'customers'
    if (location.pathname.startsWith('/dashboard/messages')) return 'messages'
    if (location.pathname.startsWith('/dashboard/campaigns')) return 'campaigns'
    if (location.pathname.startsWith('/dashboard/analytics')) return 'analytics'
    return activeNav
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const currentActive = getActiveNav()
  const onDashboardOverview = location.pathname === '/dashboard'

  const [unreadCount, setUnreadCount] = useState(0)
  useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const data = await api.get('/chat/conversations')
        if (!cancelled) setUnreadCount(data.items.reduce((sum, c) => sum + c.unreadCount, 0))
      } catch {
        // backend offline — ignore
      }
    }
    poll()
    const id = setInterval(poll, UNREAD_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  // Link (client-side navigation) không tự cuộn tới anchor như thẻ <a> gốc
  // trong cùng trang — nên khi hash đổi (kể cả sau khi điều hướng từ trang
  // khác về /dashboard#id), tự cuộn tới section tương ứng.
  useEffect(() => {
    if (!location.hash) return
    const el = document.getElementById(location.hash.slice(1))
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }, [location.pathname, location.hash])

  return (
    <div className="dash-root">
      <aside className="dash-sidebar">
        <Link to="/" className="dash-logo">
          <img src="/images/brand/logo.png" alt="Clevinum" />
          <span>{shopInfo.name}</span>
        </Link>
        <nav className="dash-nav">
          {NAV_ITEMS.map((item) => {
            if (item.id === 'products') {
              return (
                <Link
                  key={item.id}
                  to="/dashboard/products"
                  className={`dash-nav-item ${currentActive === 'products' ? 'dash-nav-active' : ''}`}
                >
                  {item.label}
                </Link>
              )
            }
            if (item.id === 'orders') {
              return (
                <Link
                  key={item.id}
                  to="/dashboard/orders"
                  className={`dash-nav-item ${currentActive === 'orders' ? 'dash-nav-active' : ''}`}
                >
                  {item.label}
                </Link>
              )
            }
            if (item.id === 'shipping') {
              return (
                <Link
                  key={item.id}
                  to="/dashboard/shipping"
                  className={`dash-nav-item ${currentActive === 'shipping' ? 'dash-nav-active' : ''}`}
                >
                  {item.label}
                </Link>
              )
            }
            if (item.id === 'customers') {
              return (
                <Link
                  key={item.id}
                  to="/dashboard/customers"
                  className={`dash-nav-item ${currentActive === 'customers' ? 'dash-nav-active' : ''}`}
                >
                  {item.label}
                </Link>
              )
            }
            if (item.id === 'messages') {
              return (
                <Link
                  key={item.id}
                  to="/dashboard/messages"
                  className={`dash-nav-item ${currentActive === 'messages' ? 'dash-nav-active' : ''}`}
                >
                  {item.label}
                  {unreadCount > 0 && <span className="dash-nav-badge">{unreadCount}</span>}
                </Link>
              )
            }
            if (item.id === 'campaigns') {
              return (
                <Link
                  key={item.id}
                  to="/dashboard/campaigns"
                  className={`dash-nav-item ${currentActive === 'campaigns' ? 'dash-nav-active' : ''}`}
                >
                  {item.label}
                </Link>
              )
            }
            if (item.id === 'analytics') {
              return (
                <Link
                  key={item.id}
                  to="/dashboard/analytics"
                  className={`dash-nav-item ${currentActive === 'analytics' ? 'dash-nav-active' : ''}`}
                >
                  {item.label}
                </Link>
              )
            }
            if (item.id === 'overview') {
              return (
                <Link
                  key={item.id}
                  to="/dashboard"
                  className={`dash-nav-item ${currentActive === 'overview' ? 'dash-nav-active' : ''}`}
                >
                  {item.label}
                </Link>
              )
            }
            // Mục còn lại (Cài đặt) hiện chỉ tồn tại
            // dưới dạng section trong trang Tổng quan, chưa có route riêng. Đang
            // ở Tổng quan → giữ nguyên <a href="#id"> để cuộn mượt tại chỗ; đang
            // ở trang khác → dùng Link để điều hướng về Tổng quan trước.
            if (onDashboardOverview) {
              return (
                <a
                  key={item.id}
                  className={`dash-nav-item ${currentActive === item.id ? 'dash-nav-active' : ''}`}
                  href={`#${item.id}`}
                >
                  {item.label}
                </a>
              )
            }
            return (
              <Link
                key={item.id}
                to={`/dashboard#${item.id}`}
                className={`dash-nav-item ${currentActive === item.id ? 'dash-nav-active' : ''}`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="dash-sidebar-footer">
          <Link to="/" className="dash-back">
            ← Về trang bán hàng
          </Link>
          <button className="dash-logout" onClick={handleLogout}>
            Đăng xuất
          </button>
        </div>
      </aside>

      <div className="dash-main">
        <header className="dash-page-header">
          <h1>{pageTitle}</h1>
          <div className="dash-page-header-actions">
            {headerActions}
            <button className="icon-bell" aria-label="Thông báo">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
                <path d="M10 20a2 2 0 0 0 4 0" />
              </svg>
              <span className="icon-bell-dot" />
            </button>
            <div className="dash-avatar">{(session?.name || 'QT').slice(0, 2).toUpperCase()}</div>
          </div>
        </header>

        {children}
      </div>
    </div>
  )
}
