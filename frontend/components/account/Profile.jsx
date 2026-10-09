'use client'

import { useEffect, useState } from 'react'
import { api } from '@/ui/api'
import { Notice, Field, input, btnPrimary } from './ui'

export function ProfileForm({ onSaved }) {
  const [form, setForm] = useState(null)
  const [state, setState] = useState({ busy: false, error: '', done: false })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    api
      .get('/account/profile')
      .then((p) => setForm({ name: p.name, email: p.email, phone: p.phone || '', dob: p.dob || '', gender: p.gender || '', hasPhone: !!p.phone }))
      .catch((e) => setState({ busy: false, error: e.message, done: false }))
  }, [])

  async function submit(e) {
    e.preventDefault()
    setState({ busy: true, error: '', done: false })
    try {
      const p = await api.patch('/account/profile', { name: form.name, phone: form.phone, dob: form.dob, gender: form.gender })
      setForm((f) => ({ ...f, name: p.name, phone: p.phone || '', hasPhone: !!p.phone }))
      onSaved?.(p)
      setState({ busy: false, error: '', done: true })
    } catch (err) {
      setState({ busy: false, error: err.message, done: false })
    }
  }

  if (!form) return state.error ? <Notice>{state.error}</Notice> : <p className="text-sm text-muted">Đang tải…</p>
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <h2 className="text-xl font-bold">Thông tin cá nhân</h2>
      {state.done && <Notice kind="ok">Đã lưu thông tin.</Notice>}
      <Notice>{state.error}</Notice>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Họ tên">
          <input className={input} value={form.name} onChange={set('name')} maxLength={100} autoComplete="name" />
        </Field>
        <Field label="Email đăng nhập">
          <input className={`${input} bg-stone-50 text-muted`} value={form.email} disabled />
        </Field>
        <Field label="Số điện thoại">
          <input className={input} value={form.phone} onChange={set('phone')} maxLength={20} inputMode="tel" autoComplete="tel" />
        </Field>
        <Field label="Ngày sinh">
          <input className={input} type="date" value={form.dob} onChange={set('dob')} max={new Date().toISOString().slice(0, 10)} />
        </Field>
        <Field label="Giới tính">
          <select className={input} value={form.gender} onChange={set('gender')}>
            <option value="">Không muốn nêu</option>
            <option value="female">Nữ</option>
            <option value="male">Nam</option>
            <option value="other">Khác</option>
          </select>
        </Field>
      </div>
      <button className={btnPrimary} disabled={state.busy}>{state.busy ? 'Đang lưu…' : 'Lưu thay đổi'}</button>
    </form>
  )
}

export function PasswordForm() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [state, setState] = useState({ busy: false, error: '', done: false })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    if (form.newPassword !== form.confirm) return setState({ busy: false, error: 'Mật khẩu nhập lại không khớp.', done: false })
    setState({ busy: true, error: '', done: false })
    try {
      await api.post('/account/password', { currentPassword: form.currentPassword, newPassword: form.newPassword })
      setForm({ currentPassword: '', newPassword: '', confirm: '' })
      setState({ busy: false, error: '', done: true })
    } catch (err) {
      setState({ busy: false, error: err.message, done: false })
    }
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-4" noValidate>
      <h2 className="text-xl font-bold">Đổi mật khẩu</h2>
      {state.done && <Notice kind="ok">Đã đổi mật khẩu.</Notice>}
      <Notice>{state.error}</Notice>
      <Field label="Mật khẩu hiện tại">
        <input className={input} type="password" value={form.currentPassword} onChange={set('currentPassword')} autoComplete="current-password" />
      </Field>
      <Field label="Mật khẩu mới (tối thiểu 8 ký tự)">
        <input className={input} type="password" value={form.newPassword} onChange={set('newPassword')} autoComplete="new-password" />
      </Field>
      <Field label="Nhập lại mật khẩu mới">
        <input className={input} type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" />
      </Field>
      <p className="text-xs text-muted">Đăng ký bằng Google và chưa đặt mật khẩu? Dùng “Quên mật khẩu” ở trang đăng nhập để tạo mật khẩu.</p>
      <button className={btnPrimary} disabled={state.busy}>{state.busy ? 'Đang lưu…' : 'Đổi mật khẩu'}</button>
    </form>
  )
}
