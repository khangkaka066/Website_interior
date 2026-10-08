'use client'

import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from '@/lib/router'
import { shopInfo } from '../../data/shop'
import { getSession, logout } from '../../auth'
import { api } from '../../api'

// `permKey` matches a backend SupportPermission key — omitted for items every
// admin can always see (Tổng quan, Cài đặt). `mainAdminOnly` items never show
// for SUPPORT_ADMIN regardless of permission toggles (role management can't
// be delegated).
const NAV_ITEMS = [
  { id: 'overview', label: 'Tổng quan', to: '/dashboard' },
  { id: 'products', label: 'Sản phẩm', to: '/dashboard/products', permKey: 'products' },
  { id: 'orders', label: 'Đơn hàng', to: '/dashboard/orders', permKey: 'orders' },
  { id: 'payments', label: 'Thanh toán', to: '/dashboard/payments', permKey: 'payments' },
  { id: 'customers', label: 'Khách hàng', to: '/dashboard/customers', permKey: 'customers' },
  { id: 'shipping', label: 'Vận chuyển', to: '/dashboard/shipping', permKey: 'shipping' },
  { id: 'messages', label: 'Tin nhắn', to: '/dashboard/messages', permKey: 'messages' },
  { id: 'campaigns', label: 'Quảng cáo', to: '/dashboard/campaigns', permKey: 'campaigns' },
  { id: 'news', label: 'Tin tức', to: '/dashboard/news', permKey: 'posts' },
  { id: 'analytics', label: 'Phân tích', to: '/dashboard/analytics', permKey: 'analytics' },
  { id: 'settings', label: 'Cài đặt', to: '/dashboard/settings', mainAdminOnly: true },
]

const UNREAD_POLL_MS = 10000

export function useCanAccess() {
  const session = getSession()
  const [permissions, setPermissions] = useState(null)

  useEffect(() => {
    api.get('/permissions').then((data) => {
      setPermissions(Object.fromEntries(data.items.map((p) => [p.key, p.enabledForSupport])))
    }).catch(() => setPermissions({}))
  }, [])

  function canAccess(permKey) {
    if (!permKey) return true
    if (session?.adminRole === 'MAIN_ADMIN') return true
    if (permissions === null) return false // don't flash restricted content while loading
    return !!permissions[permKey]
  }

  return { canAccess, permissionsLoaded: permissions !== null }
}

export default function AdminLayout({ activeNav, pageTitle, headerActions, children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const session = getSession()
  const { canAccess } = useCanAccess()

  const getActiveNav = () => {
    if (location.pathname === '/dashboard') return 'overview'
    const match = NAV_ITEMS.find((item) => item.to && item.to !== '/dashboard' && location.pathname.startsWith(item.to))
    return match?.id || activeNav
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const currentActive = getActiveNav()
  const onDashboardOverview = location.pathname === '/dashboard'
  const isMainAdmin = session?.adminRole === 'MAIN_ADMIN'

  const [unreadCount, setUnreadCount] = useState(0)
  useEffect(() => {
    if (!canAccess('messages')) return
    let cancelled = false
    async function poll() {
      try {
        const data = await api.get('/chat/conversations')
        if (!cancelled) setUnreadCount(data.items.reduce((sum, c) => sum + c.unreadCount, 0))
      } catch {
        // backend offline / no access — ignore
      }
    }
    poll()
    const id = setInterval(poll, UNREAD_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Link (client-side navigation) không tự cuộn tới anchor như thẻ <a> gốc
  // trong cùng trang — nên khi hash đổi (kể cả sau khi điều hướng từ trang
  // khác về /dashboard#id), tự cuộn tới section tương ứng.
  useEffect(() => {
    if (!location.hash) return
    const el = document.getElementById(location.hash.slice(1))
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }, [location.pathname, location.hash])

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.mainAdminOnly) return isMainAdmin
    return canAccess(item.permKey)
  })

  return (
    <div className="dash-root">
      <aside className="dash-sidebar">
        <Link to="/" className="dash-logo">
          <img src="/images/brand/logo.png" alt="Clevinum" />
          <span>{shopInfo.name}</span>
        </Link>
        <nav className="dash-nav">
          {visibleItems.map((item) => {
            if (item.id === 'messages') {
              return (
                <Link key={item.id} to={item.to} className={`dash-nav-item ${currentActive === item.id ? 'dash-nav-active' : ''}`}>
                  {item.label}
                  {unreadCount > 0 && <span className="dash-nav-badge">{unreadCount}</span>}
                </Link>
              )
            }
            if (item.to) {
              return (
                <Link key={item.id} to={item.to} className={`dash-nav-item ${currentActive === item.id ? 'dash-nav-active' : ''}`}>
                  {item.label}
                </Link>
              )
            }
            // Anchor-only items (Cài đặt) hiện chỉ tồn tại dưới dạng section
            // trong trang Tổng quan, chưa có route riêng. Đang ở Tổng quan →
            // giữ nguyên <a href="#id"> để cuộn mượt tại chỗ; đang ở trang
            // khác → dùng Link để điều hướng về Tổng quan trước.
            if (onDashboardOverview) {
              return (
                <a key={item.id} className={`dash-nav-item ${currentActive === item.id ? 'dash-nav-active' : ''}`} href={`#${item.id}`}>
                  {item.label}
                </a>
              )
            }
            return (
              <Link key={item.id} to={`/dashboard#${item.id}`} className={`dash-nav-item ${currentActive === item.id ? 'dash-nav-active' : ''}`}>
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
            <div className="dash-avatar" title={isMainAdmin ? 'Main Admin' : session?.adminRole === 'SUPPORT_ADMIN' ? 'Support Admin' : ''}>
              {(session?.name || 'QT').slice(0, 2).toUpperCase()}
            </div>
          </div>
        </header>

        {children}
      </div>
    </div>
  )
}
