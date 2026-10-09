'use client'

import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from '@/lib/router'
import { getSession, logout } from '@/ui/auth'
import { OrderList, OrderDetail } from './Orders'
import { ProfileForm, PasswordForm } from './Profile'
import { Addresses } from './Addresses'

const TABS = [
  { id: 'orders', label: 'Đơn hàng' },
  { id: 'profile', label: 'Thông tin cá nhân' },
  { id: 'addresses', label: 'Sổ địa chỉ' },
  { id: 'password', label: 'Đổi mật khẩu' },
]

// Trang Tài khoản của khách. Tab và đơn đang xem nằm trên địa chỉ (?tab=, ?order=) để tải lại / quay lại vẫn đúng chỗ.
export default function AccountPage() {
  const [session, setSession] = useState(undefined) // undefined: chưa đọc phiên (tránh nháy chuyển trang khi vừa mở)
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const s = getSession()
    if (!s) navigate('/login?from=/account', { replace: true })
    else if (s.role === 'ADMIN') navigate('/dashboard', { replace: true })
    else setSession(s)
  }, [navigate])

  if (!session) return null

  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'orders'
  const order = tab === 'orders' ? params.get('order') : null
  const go = (next) => setParams(next)

  return (
    <main className="tw-reset mx-auto w-full max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Tài khoản của tôi</h1>
          <p className="mt-1 text-sm text-muted">Xin chào, {session.name} · {session.email}</p>
        </div>
        <button
          className="text-sm text-muted underline hover:text-accent"
          onClick={() => {
            logout()
            navigate('/')
          }}
        >
          Đăng xuất
        </button>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-[220px_1fr]">
        <nav aria-label="Menu tài khoản" className="flex gap-2 overflow-x-auto md:flex-col">
          {TABS.map((t) => (
            <Link
              key={t.id}
              to={`/account?tab=${t.id}`}
              aria-current={t.id === tab ? 'page' : undefined}
              className={`whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium ${
                t.id === tab ? 'bg-accent text-white' : 'border border-line bg-white hover:border-accent'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        <div className="min-w-0">
          {tab === 'orders' &&
            (order ? (
              <OrderDetail orderNumber={order} onBack={() => go({ tab: 'orders' })} />
            ) : (
              <OrderList onOpen={(n) => go({ tab: 'orders', order: n })} />
            ))}
          {tab === 'profile' && (
            <ProfileForm onSaved={(p) => {
              // Giữ tên trên Header đồng bộ với tên vừa sửa.
              try {
                const s = JSON.parse(sessionStorage.getItem('clevinum_session'))
                sessionStorage.setItem('clevinum_session', JSON.stringify({ ...s, name: p.name }))
              } catch {}
              setSession((s) => ({ ...s, name: p.name }))
            }} />
          )}
          {tab === 'addresses' && <Addresses />}
          {tab === 'password' && <PasswordForm />}
        </div>
      </div>
    </main>
  )
}
