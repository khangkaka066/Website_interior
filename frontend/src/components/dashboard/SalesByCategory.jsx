import Chart from 'react-apexcharts'
import { salesByCategory } from '../../data/dashboardDemo'

const COLORS = ['#b5602f', '#e0a559', '#3aa0c9', '#3e8e4f', '#8f4a24']

export default function SalesByCategory() {
  const options = {
    chart: { type: 'bar', toolbar: { show: false } },
    plotOptions: { bar: { horizontal: true, borderRadius: 0, distributed: true, barHeight: '55%' } },
    colors: COLORS,
    dataLabels: {
      enabled: true,
      formatter: (val) => `${val}%`,
      style: { colors: ['#2b211c'] },
      offsetX: 20,
    },
    grid: { borderColor: '#ece0d6' },
    xaxis: {
      categories: salesByCategory.map((c) => c.name),
      labels: { style: { colors: '#a89685' } },
    },
    yaxis: { labels: { style: { colors: '#7a6f68' } } },
    legend: { show: false },
    tooltip: { theme: 'light' },
  }

  return (
    <div className="dash-card">
      <div className="dash-card-head">
        <h3>Doanh thu theo danh mục</h3>
        <span className="dash-tag">dữ liệu minh họa</span>
      </div>
      <Chart
        options={options}
        series={[{ name: 'Tỷ trọng', data: salesByCategory.map((c) => c.value) }]}
        type="bar"
        height={260}
      />
    </div>
  )
}
