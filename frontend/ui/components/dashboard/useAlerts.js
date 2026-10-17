'use client'

import { useEffect, useState } from 'react'
import { api } from '../../api'

const POLL_MS = 10000

// Số việc đang chờ nhân viên: đơn cần xử lý, đánh giá chưa trả lời, tin nhắn khách chưa đọc. Mục nào không có quyền thì giữ 0.
// Dùng chung cho thanh menu (huy hiệu số) và khối "Việc cần làm" ở trang Tổng quan.
export function useAlerts({ orders, messages }) {
  const [alerts, setAlerts] = useState({ orders: 0, overdue: 0, reviews: 0, messages: 0 })

  useEffect(() => {
    if (!orders && !messages) return undefined
    let cancelled = false
    async function poll() {
      if (document.visibilityState === 'hidden') return
      const [w, c] = await Promise.all([
        orders ? api.get('/orders/workload').catch(() => null) : null,
        messages ? api.get('/chat/conversations').catch(() => null) : null,
      ])
      if (cancelled) return
      setAlerts((prev) => ({
        orders: w ? w.needsAction || 0 : prev.orders,
        overdue: w ? w.overdue || 0 : prev.overdue,
        reviews: w ? w.reviewsToReply || 0 : prev.reviews,
        messages: c ? c.items.reduce((sum, x) => sum + x.unreadCount, 0) : prev.messages,
      }))
    }
    poll()
    const id = setInterval(poll, POLL_MS)
    document.addEventListener('visibilitychange', poll)
    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', poll)
    }
  }, [orders, messages])

  return alerts
}
