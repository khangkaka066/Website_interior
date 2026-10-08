'use client'

import { useState } from 'react'
import { api } from '@/ui/api'
import { BUSINESS_AREAS } from '@/ui/data/menu'

const OTHER = 'Khác / chưa rõ'

// Form liên hệ: gửi vào hộp thư "Tin nhắn" của trang quản trị (cùng hệ thống với khung chat), nên admin trả lời ngay trong đó.
export default function ContactForm() {
  const [form, setForm] = useState({ name: '', phone: '', email: '', topic: BUSINESS_AREAS[2], message: '' })
  const [state, setState] = useState({ sending: false, error: '', done: false })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim() || !form.message.trim()) {
      return setState({ sending: false, error: 'Vui lòng nhập họ tên, số điện thoại và nội dung cần tư vấn.', done: false })
    }
    setState({ sending: true, error: '', done: false })
    try {
      const conv = await api.post('/chat/conversations', { name: form.name.trim(), phone: form.phone.trim() })
      const content = [
        `[Liên hệ từ website] Chủ đề: ${form.topic}`,
        form.email.trim() && `Email: ${form.email.trim()}`,
        '',
        form.message.trim(),
      ]
        .filter((l) => l !== false)
        .join('\n')
      await api.post(`/chat/conversations/${conv.id}/messages`, { content })
      setForm((f) => ({ ...f, message: '' }))
      setState({ sending: false, error: '', done: true })
    } catch (err) {
      setState({ sending: false, error: err.message, done: false })
    }
  }

  const field = 'mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-accent'
  return (
    <form onSubmit={submit} className="tw-reset mt-10 rounded-xl border border-line bg-white p-6" noValidate>
      <h2 className="text-xl font-bold">Gửi yêu cầu tư vấn</h2>
      <p className="mt-1 text-sm text-muted">Để lại thông tin, chúng tôi liên hệ lại trong giờ làm việc.</p>

      {state.done && (
        <p className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800" role="status">
          Đã gửi yêu cầu. Cảm ơn bạn, chúng tôi sẽ phản hồi sớm nhất có thể.
        </p>
      )}
      {state.error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Họ tên *
          <input className={field} value={form.name} onChange={set('name')} maxLength={100} autoComplete="name" />
        </label>
        <label className="text-sm font-medium">
          Số điện thoại *
          <input className={field} value={form.phone} onChange={set('phone')} maxLength={20} inputMode="tel" autoComplete="tel" />
        </label>
        <label className="text-sm font-medium">
          Email
          <input className={field} type="email" value={form.email} onChange={set('email')} maxLength={120} autoComplete="email" />
        </label>
        <label className="text-sm font-medium">
          Bạn cần tư vấn về
          <select className={field} value={form.topic} onChange={set('topic')}>
            {[...BUSINESS_AREAS, OTHER].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          Nội dung *
          <textarea className={field} rows={5} value={form.message} onChange={set('message')} maxLength={1500} />
        </label>
      </div>

      <button type="submit" disabled={state.sending} className="mt-5 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60">
        {state.sending ? 'Đang gửi…' : 'Gửi yêu cầu'}
      </button>
    </form>
  )
}
