import Chart from 'react-apexcharts'
import { customerOverview } from '../../data/dashboardDemo'

export default function CustomerOverview() {
  const { newCustomers, returningCustomers, totalCustomers, returningRate } = customerOverview

  const options = {
    chart: { type: 'donut' },
    labels: ['Khách hàng mới', 'Khách hàng quay lại'],
    colors: ['#e0a559', '#b5602f'],
    legend: { labels: { colors: '#7a6f68' }, position: 'bottom' },
    dataLabels: { enabled: false },
    stroke: { show: false },
    tooltip: { theme: 'light' },
  }

  return (
    <div className="dash-card">
      <div className="dash-card-head">
        <h3>Khách hàng</h3>
        <span className="dash-tag">dữ liệu minh họa</span>
      </div>
      <div className="customer-stats">
        <div>
          <strong>{totalCustomers}</strong>
          <span>Tổng khách hàng</span>
        </div>
        <div>
          <strong>{newCustomers}</strong>
          <span>Khách hàng mới</span>
        </div>
        <div>
          <strong>{returningCustomers}</strong>
          <span>Quay lại</span>
        </div>
        <div>
          <strong>{returningRate}%</strong>
          <span>Tỷ lệ quay lại</span>
        </div>
      </div>
      <Chart
        options={options}
        series={[newCustomers, returningCustomers]}
        type="donut"
        height={220}
      />
    </div>
  )
}
