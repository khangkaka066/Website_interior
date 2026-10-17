'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { api } from '@/ui/api'

// Trang đích của link "Hủy đăng ký" trong email khuyến mãi. Cần bấm xác nhận (không hủy ngay khi mở link,
// vì một số hộp thư tự mở trước các link trong email).
export default function UnsubscribeForm() {
  const token = useSearchParams().get('token') || ''
  const [state, setState] = useState({ status: 'idle', message: '' }) // idle | busy | done | error

  async function confirm() {
    setState({ status: 'busy', message: '' })
    try {
      await api.post('/shop/unsubscribe', { token })
      setState({ status: 'done', message: '' })
    } catch (err) {
      setState({ status: 'error', message: err.message })
    }
  }

  if (!token) return <p className="mt-6 text-muted">Liên kết không hợp lệ. Hãy dùng nút "Hủy đăng ký" trong email bạn nhận được.</p>
  if (state.status === 'done') {
    return (
      <div className="mt-6 max-w-xl rounded-2xl border border-line bg-white p-6">
        <p className="font-semibold">Đã hủy đăng ký.</p>
        <p className="mt-2 text-sm text-muted">Bạn sẽ không nhận email khuyến mãi từ chúng tôi nữa. Email về đơn hàng của bạn vẫn được gửi bình thường.</p>
        <a href="/" className="mt-4 inline-block text-sm font-semibold text-accent underline">Về trang chủ</a>
      </div>
    )
  }
  return (
    <div className="mt-6 max-w-xl rounded-2xl border border-line bg-white p-6">
      <p>Bạn muốn ngừng nhận email khuyến mãi từ chúng tôi?</p>
      <button type="button" onClick={confirm} disabled={state.status === 'busy'} className="mt-4 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">
        {state.status === 'busy' ? 'Đang xử lý…' : 'Xác nhận hủy đăng ký'}
      </button>
      {state.status === 'error' && <p className="mt-3 text-sm text-red-600" role="alert">{state.message}</p>}
    </div>
  )
}
