import { products } from '../../data/shop'
import { topProducts } from '../../data/dashboardDemo'
import { TrendUpIcon, TrendDownIcon } from './DashIcons'

export default function TopProducts() {
  const rows = topProducts.map((row) => ({
    ...row,
    product: products.find((p) => p.id === row.id),
  }))

  return (
    <div className="dash-card dash-card-wide">
      <div className="dash-card-head">
        <h3>Top 5 sản phẩm bán chạy</h3>
        <span className="dash-tag">tên sản phẩm thật · số liệu kỳ minh họa</span>
      </div>
      <table className="dash-table">
        <thead>
          <tr>
            <th>Sản phẩm</th>
            <th>Danh mục</th>
            <th>Đã bán</th>
            <th>Doanh thu</th>
            <th>Tồn kho</th>
            <th>Xu hướng</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="dash-product-cell">
                <img src={row.product.image} alt={row.product.name} />
                <span>{row.product.name}</span>
              </td>
              <td>{row.category}</td>
              <td>{row.sold}</td>
              <td>{row.revenue}</td>
              <td>
                {row.stock === 0 ? (
                  <span className="stock-badge stock-out">Hết hàng</span>
                ) : row.stock <= 10 ? (
                  <span className="stock-badge stock-low">{row.stock} (sắp hết)</span>
                ) : (
                  row.stock
                )}
              </td>
              <td>
                <span className={`trend-tag ${row.trend >= 0 ? 'trend-up' : 'trend-down'}`}>
                  {row.trend >= 0 ? <TrendUpIcon /> : <TrendDownIcon />}
                  {Math.abs(row.trend)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
