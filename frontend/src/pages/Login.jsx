import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { login, registerCustomer, loginWithGoogleProfile } from '../auth'
import { shopInfo } from '../data/shop'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.29-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  )
}

function GoogleButton({ onProfile }) {
  const [notice, setNotice] = useState('')

  function requestProfile(tokenResponse) {
    fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
    })
      .then((res) => res.json())
      .then((profile) => {
        onProfile({ name: profile.name, email: profile.email, picture: profile.picture })
      })
      .catch(() => setNotice('Không lấy được thông tin tài khoản Google, thử lại sau.'))
  }

  function handleClick() {
    setNotice('')

    if (!GOOGLE_CLIENT_ID) {
      setNotice('Chưa cấu hình VITE_GOOGLE_CLIENT_ID trong file .env (xem .env.example).')
      return
    }
    if (!window.google?.accounts?.oauth2) {
      setNotice('Google SDK chưa tải xong, vui lòng thử lại sau vài giây.')
      return
    }

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'openid email profile',
      callback: requestProfile,
    })
    client.requestAccessToken()
  }

  return (
    <>
      <button type="button" className="google-btn" onClick={handleClick}>
        <GoogleIcon />
        Đăng nhập bằng Google
      </button>
      {notice && <span className="login-notice">{notice}</span>}
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

  async function handleGoogleProfile(profile) {
    try {
      const user = await loginWithGoogleProfile(profile)
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
          <button type="submit" className="login-submit" disabled={submitting}>
            {submitting ? 'Đang xử lý...' : mode === 'signin' ? 'Đăng nhập' : 'Tạo tài khoản'}
          </button>
        </form>

        <div className="login-divider">
          <span>hoặc</span>
        </div>

        <GoogleButton onProfile={handleGoogleProfile} />

        <Link to="/" className="login-back">
          ← Về trang bán hàng
        </Link>
      </div>
    </div>
  )
}
