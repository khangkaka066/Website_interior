'use client'

import { useEffect, useState } from 'react'
import { Link } from '@/lib/router'
import { useAlerts } from './useAlerts'
import { useCanAccess } from './AdminLayout'

const KEY = 'clevinum_dismissed_notices'

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {}
  } catch {
    return {}
  }
}

// Thông báo ở đầu trang Tổng quan: những việc đang chờ nhân viên xử lý. Bấm ✕ để xóa một thông báo; thông báo đó chỉ hiện lại khi con số đổi
// (ví dụ có thêm đơn mới), nên xóa rồi không bị làm phiền bởi chính việc đã biết.
export default function TodoList() {
  const { canAccess } = useCanAccess()
  const a = useAlerts({ orders: canAccess('orders'), messages: canAccess('messages') })
  const [dismissed, setDismissed] = useState({})
  useEffect(() => setDismissed(load()), [])

  const items = [
    { id: 'orders', n: a.orders, to: '/dashboard/orders?needsAction=1', text: 'đơn hàng cần xử lý', warn: a.overdue > 0 && `${a.overdue} đơn quá hạn` },
    { id: 'reviews', n: a.reviews, to: '/dashboard/reviews?status=unanswered', text: 'đánh giá của khách chưa trả lời' },
    { id: 'messages', n: a.messages, to: '/dashboard/messages', text: 'tin nhắn khách chưa đọc' },
  ].filter((i) => i.n > 0 && dismissed[i.id] !== i.n)

  function dismiss(i) {
    const next = { ...dismissed, [i.id]: i.n }
    setDismissed(next)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      // bỏ qua: chỉ mất trạng thái đã xóa
    }
  }

  if (items.length === 0) return null
  return (
    <section className="notice-list" aria-label="Thông báo">
      {items.map((i) => (
        <div className="notice" key={i.id} role="status">
          <Link to={i.to} className="notice-link">
            <strong className="notice-n">{i.n}</strong>
            <span>{i.text}</span>
            {i.warn && <em className="notice-warn">{i.warn}</em>}
          </Link>
          <button type="button" className="notice-x" onClick={() => dismiss(i)} aria-label={`Xóa thông báo: ${i.n} ${i.text}`}>
            ✕
          </button>
        </div>
      ))}
    </section>
  )
}
