'use client'

import { useEffect, useState } from 'react'
import { useNavigate } from '@/lib/router'
import { api } from '../../api'
import { ORDER_STATUS, PAYMENT_STATUS, orderStatusLabel, paymentStatusLabel } from '../../constants/orderStatus'
import { formatCurrency, formatDate } from '../../utils/format'

export default function RecentOrders() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState(null)

  useEffect(() => {
    let cancelled = false
    api
      .get('/orders?pageSize=8')
      .then((r) => !cancelled && setOrders(r.items))
      .catch(() => !cancelled && setOrders([]))
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="dash-card dash-card-wide">
      <div className="dash-card-head">
        <h3>Đơn hàng gần đây</h3>
        <span className="dash-tag dash-tag-real">dữ liệu thật</span>
      </div>
      {orders && orders.length === 0 ? (
        <p className="dash-empty-state">Chưa có đơn hàng nào.</p>
      ) : (
        <table className="dash-table">
          <thead>
            <tr>
              <th>Mã đơn</th>
              <th>Khách hàng</th>
              <th>Tổng tiền</th>
              <th>Thanh toán</th>
              <th>Trạng thái</th>
              <th>Thời gian</th>
            </tr>
          </thead>
          <tbody>
            {(orders || []).map((o) => (
              <tr key={o.id}>
                <td>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      navigate(`/dashboard/orders/${o.id}`)
                    }}
                  >
                    {o.orderNumber}
                  </a>
                </td>
                <td>{o.customer?.name || o.recipientName}</td>
                <td>{formatCurrency(o.total)}</td>
                <td>
                  <span className={`order-status-badge ${PAYMENT_STATUS[o.paymentStatus]?.cls || ''}`}>{paymentStatusLabel(o.paymentStatus)}</span>
                </td>
                <td>
                  <span className={`order-status-badge ${ORDER_STATUS[o.status]?.cls || ''}`}>{orderStatusLabel(o.status)}</span>
                </td>
                <td>{formatDate(o.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
