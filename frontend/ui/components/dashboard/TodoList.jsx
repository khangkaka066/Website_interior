'use client'

import { Link } from '@/lib/router'
import { useAlerts } from './useAlerts'
import { useCanAccess } from './AdminLayout'

// Việc cần làm: những thứ đang chờ nhân viên xử lý, bấm vào để mở đúng trang. Mục nào bằng 0 thì ẩn.
export default function TodoList() {
  const { canAccess } = useCanAccess()
  const a = useAlerts({ orders: canAccess('orders'), messages: canAccess('messages') })
  const items = [
    { n: a.orders, to: '/dashboard/orders?needsAction=1', text: 'đơn hàng cần xử lý', warn: a.overdue > 0 && `${a.overdue} đơn quá hạn` },
    { n: a.reviews, to: '/dashboard/reviews?status=unanswered', text: 'đánh giá của khách chưa trả lời' },
    { n: a.messages, to: '/dashboard/messages', text: 'tin nhắn khách chưa đọc' },
  ].filter((i) => i.n > 0)

  return (
    <div className="dash-card todo-card">
      <div className="dash-card-head">
        <h3>Việc cần làm</h3>
        {items.length > 0 && <span className="pa-count">{items.reduce((s, i) => s + i.n, 0)}</span>}
      </div>
      {items.length === 0 ? (
        <p className="pa-ok">✓ Không có việc nào đang chờ. Mọi thứ đã được xử lý.</p>
      ) : (
        <ul className="todo-list">
          {items.map((i) => (
            <li key={i.to}>
              <Link to={i.to}>
                <strong className="todo-n">{i.n}</strong>
                <span>{i.text}</span>
                {i.warn && <em className="todo-warn">{i.warn}</em>}
                <span className="todo-go" aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
