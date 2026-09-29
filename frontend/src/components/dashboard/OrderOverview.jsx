import { orderStatuses } from '../../data/dashboardDemo'

export default function OrderOverview() {
  const max = Math.max(...orderStatuses.map((s) => s.count))

  return (
    <div className="dash-card">
      <div className="dash-card-head">
        <h3>Tình trạng đơn hàng</h3>
        <span className="dash-tag">dữ liệu minh họa</span>
      </div>
      <div className="order-status-list">
        {orderStatuses.map((s) => (
          <div className="order-status-row" key={s.id}>
            <div className="order-status-label">
              <span>{s.label}</span>
              <strong>{s.count}</strong>
            </div>
            <div className="order-status-track">
              <div
                className="order-status-fill"
                style={{ width: `${(s.count / max) * 100}%`, background: s.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
