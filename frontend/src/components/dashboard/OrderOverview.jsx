import { useEffect, useState } from 'react'
import { api } from '../../api'
import { ORDER_STATUS } from '../../constants/orderStatus'

const COLORS = {
  PENDING_CONFIRMATION: '#a89685',
  CONFIRMED: '#3aa0c9',
  PROCESSING: '#6cb7d6',
  AWAITING_SHIPMENT: '#e0a559',
  SHIPPING: '#b5602f',
  DELIVERED: '#3e8e4f',
  CANCELLED: '#d14343',
  RETURNED: '#8f4a24',
}

// Đếm đơn theo trạng thái từ dữ liệu thật.
export default function OrderOverview() {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    let cancelled = false
    const keys = Object.keys(ORDER_STATUS)
    Promise.all(keys.map((k) => api.get(`/orders?status=${k}&pageSize=1`).then((r) => r.total || 0)))
      .then((counts) => !cancelled && setRows(keys.map((k, i) => ({ id: k, label: ORDER_STATUS[k].label, count: counts[i], color: COLORS[k] }))))
      .catch(() => !cancelled && setRows([]))
    return () => {
      cancelled = true
    }
  }, [])

  const total = rows?.reduce((s, r) => s + r.count, 0) || 0
  const max = Math.max(1, ...(rows || []).map((s) => s.count))

  return (
    <div className="dash-card">
      <div className="dash-card-head">
        <h3>Tình trạng đơn hàng</h3>
        <span className="dash-tag dash-tag-real">dữ liệu thật</span>
      </div>
      {rows && total === 0 && <p className="dash-empty-state">Chưa có đơn hàng nào.</p>}
      <div className="order-status-list">
        {(rows || []).map((s) => (
          <div className="order-status-row" key={s.id}>
            <div className="order-status-label">
              <span>{s.label}</span>
              <strong>{s.count}</strong>
            </div>
            <div className="order-status-track">
              <div className="order-status-fill" style={{ width: `${(s.count / max) * 100}%`, background: s.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
