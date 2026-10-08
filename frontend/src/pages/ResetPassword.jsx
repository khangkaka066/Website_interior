import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { shopInfo } from '../data/shop'
import { useSeo } from '../useSeo'

// Một trang cho hai bước: không có ?token= thì nhập email để nhận liên kết; có ?token= (từ email) thì đặt mật khẩu mới.
export default function ResetPassword() {
  useSeo({ title: 'Quên mật khẩu', noindex: true })
  const [params] = useSearchParams()
  const token = params.get('token')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (token) {
      if (password.length < 8) return setError('Mật khẩu cần ít nhất 8 ký tự.')
      if (password !== confirm) return setError('Hai mật khẩu chưa giống nhau.')
    }
    setSubmitting(true)
    try {
      const res = token
        ? await api.post('/auth/reset-password', { token, password })
        : await api.post('/auth/forgot-password', { email: email.trim() })
      setDone(res.message)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-root">
      <div className="login-card">
        <img className="login-logo" src="/images/brand/logo.png" alt={shopInfo.name} />
        <h1>{token ? 'Đặt mật khẩu mới' : 'Quên mật khẩu'}</h1>
        <p>
          {token
            ? 'Nhập mật khẩu mới cho tài khoản của bạn.'
            : 'Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết để bạn đặt lại mật khẩu.'}
        </p>

        {done ? (
          <>
            <p className="login-success">{done}</p>
            <Link to="/login" className="login-submit" style={{ textAlign: 'center', display: 'block' }}>
              Về trang đăng nhập
            </Link>
          </>
        ) : (
          <form onSubmit={submit} className="login-form">
            {token ? (
              <>
                <label>
                  Mật khẩu mới
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Ít nhất 8 ký tự" autoFocus />
                </label>
                <label>
                  Nhập lại mật khẩu
                  <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
                </label>
              </>
            ) : (
              <label>
                Email
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ban@email.com" required autoFocus />
              </label>
            )}
            {error && <span className="login-error">{error}</span>}
            <button type="submit" className="login-submit" disabled={submitting}>
              {submitting ? 'Đang xử lý...' : token ? 'Đổi mật khẩu' : 'Gửi liên kết'}
            </button>
          </form>
        )}

        <Link to="/login" className="login-back">
          ← Quay lại đăng nhập
        </Link>
      </div>
    </div>
  )
}
