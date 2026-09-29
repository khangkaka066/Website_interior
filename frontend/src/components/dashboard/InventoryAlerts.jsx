import { Link } from 'react-router-dom'
import { products } from '../../data/shop'
import { inventoryAlerts } from '../../data/dashboardDemo'

export default function InventoryAlerts() {
  const rows = inventoryAlerts.map((row) => ({
    ...row,
    product: products.find((p) => p.id === row.id),
  }))

  return (
    <div className="dash-card">
      <div className="dash-card-head">
        <h3>Cảnh báo tồn kho</h3>
        <span className="dash-tag">dữ liệu minh họa</span>
      </div>
      <div className="alert-list">
        {rows.map((row) => (
          <div className="alert-row" key={row.id}>
            <img src={row.product.image} alt={row.product.name} />
            <div className="alert-info">
              <span className="alert-name">{row.product.name}</span>
              <span className="alert-stock">Tồn kho: {row.stock}</span>
            </div>
            <span className={`stock-badge ${row.status === 'out' ? 'stock-out' : 'stock-low'}`}>
              {row.status === 'out' ? 'Hết hàng' : 'Sắp hết'}
            </span>
          </div>
        ))}
      </div>
      <Link to="/products" className="dash-btn alert-cta">
        Xem sản phẩm
      </Link>
    </div>
  )
}
