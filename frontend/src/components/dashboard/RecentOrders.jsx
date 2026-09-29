import { recentOrders } from '../../data/dashboardDemo'

const STATUS_CLASS = {
  'Chờ thanh toán': 'status-pending',
  'Đang xử lý': 'status-processing',
  'Chờ giao': 'status-ready',
  'Đang vận chuyển': 'status-shipping',
  'Đã giao': 'status-delivered',
  'Đã hủy': 'status-cancelled',
  'Đã trả hàng': 'status-returned',
}

export default function RecentOrders() {
  return (
    <div className="dash-card dash-card-wide">
      <div className="dash-card-head">
        <h3>Đơn hàng gần đây</h3>
        <span className="dash-tag">dữ liệu minh họa</span>
      </div>
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
          {recentOrders.map((o) => (
            <tr key={o.id}>
              <td>{o.id}</td>
              <td>{o.customer}</td>
              <td>{o.total}</td>
              <td>{o.payment}</td>
              <td>
                <span className={`order-status-badge ${STATUS_CLASS[o.status]}`}>{o.status}</span>
              </td>
              <td>{o.time}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
