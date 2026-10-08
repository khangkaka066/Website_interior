'use client'

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation, Link } from '@/lib/router'
import { login, registerCustomer, loginWithGoogleCredential } from '../auth'
import { shopInfo } from '../data/shop'

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

// Nút "Đăng nhập bằng Google" chính thức (Google Identity Services): Google trả về ID token, server xác minh lại token đó.
// Chưa cấu hình VITE_GOOGLE_CLIENT_ID thì ẩn hẳn, không hiện nút không dùng được.
function GoogleButton({ onCredential }) {
  const holder = useRef(null)
  const latest = useRef(onCredential)
  latest.current = onCredential // luôn gọi bản mới nhất mà không phải khởi tạo lại nút Google

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined
    let stopped = false
    const mount = () => {
      const gsi = window.google?.accounts?.id
      if (stopped || !gsi || !holder.current) return !!gsi
      gsi.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (res) => latest.current(res.credential) })
      gsi.renderButton(holder.current, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', width: 320 })
      return true
    }
    // Script của Google tải bất đồng bộ: thử lại cho đến khi sẵn sàng.
    if (mount()) return undefined
    const timer = setInterval(() => mount() && clearInterval(timer), 300)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [])

  if (!GOOGLE_CLIENT_ID) return null
  return (
    <>
      <div className="login-divider">
        <span>hoặc</span>
      </div>
      <div ref={holder} className="google-btn-holder" />
    </>
  )
}

export default function Login() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  function goAfterLogin(user) {
    if (user.role === 'ADMIN') {
      navigate(location.state?.from || '/dashboard', { replace: true })
    } else {
      navigate('/', { replace: true })
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    if (mode === 'signin') {
      const result = await login(username, password)
      setSubmitting(false)
      if (!result.ok) return setError(result.error)
      goAfterLogin(result.user)
    } else {
      const result = await registerCustomer({ name, username, password })
      setSubmitting(false)
      if (!result.ok) return setError(result.error)
      goAfterLogin(result.user)
    }
  }

  async function handleGoogleCredential(credential) {
    try {
      const user = await loginWithGoogleCredential(credential)
      goAfterLogin(user)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="login-root">
      <div className="login-card">
        <img className="login-logo" src="/images/brand/logo.png" alt={shopInfo.name} />
        <h1>{mode === 'signin' ? 'Đăng nhập' : 'Tạo tài khoản'}</h1>
        <p>
          {mode === 'signin'
            ? `Đăng nhập để mua hàng tại ${shopInfo.name}.`
            : `Tạo tài khoản khách hàng mới tại ${shopInfo.name}.`}
        </p>

        <div className="login-tabs">
          <button
            className={`login-tab ${mode === 'signin' ? 'login-tab-active' : ''}`}
            onClick={() => {
              setMode('signin')
              setError('')
            }}
          >
            Đăng nhập
          </button>
          <button
            className={`login-tab ${mode === 'signup' ? 'login-tab-active' : ''}`}
            onClick={() => {
              setMode('signup')
              setError('')
            }}
          >
            Đăng ký
          </button>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {mode === 'signup' && (
            <label>
              Họ tên
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nguyễn Văn A"
              />
            </label>
          )}
          <label>
            {mode === 'signin' ? 'Số điện thoại hoặc email' : 'Email'}
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={mode === 'signin' ? 'Email hoặc số điện thoại của bạn' : 'ban@email.com'}
              autoFocus
            />
          </label>
          <label>
            Mật khẩu
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>
          {error && <span className="login-error">{error}</span>}
          {mode === 'signin' && (
            <Link to="/forgot-password" className="login-forgot">
              Quên mật khẩu?
            </Link>
          )}
          <button type="submit" className="login-submit" disabled={submitting}>
            {submitting ? 'Đang xử lý...' : mode === 'signin' ? 'Đăng nhập' : 'Tạo tài khoản'}
          </button>
        </form>

        <GoogleButton onCredential={handleGoogleCredential} />

        <Link to="/" className="login-back">
          ← Về trang bán hàng
        </Link>
      </div>
    </div>
  )
}
