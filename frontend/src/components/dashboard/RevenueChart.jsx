import { useState } from 'react'
import Chart from 'react-apexcharts'
import { revenueSeries } from '../../data/dashboardDemo'

const METRICS = [
  { id: 'revenue', label: 'Doanh thu', unit: 'tr đ' },
  { id: 'orders', label: 'Số đơn hàng', unit: 'đơn' },
]

export default function RevenueChart() {
  const [metric, setMetric] = useState('revenue')
  const data = revenueSeries[metric]

  const options = {
    chart: { type: 'area', toolbar: { show: false } },
    colors: ['#b5602f', '#e0c9b8'],
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: [3, 2], dashArray: [0, 4] },
    fill: {
      type: 'gradient',
      gradient: { shadeIntensity: 1, opacityFrom: 0.28, opacityTo: 0, stops: [0, 90, 100] },
    },
    grid: { borderColor: '#ece0d6' },
    legend: { show: true, labels: { colors: '#7a6f68' }, markers: { radius: 4 } },
    xaxis: {
      categories: revenueSeries.categories,
      labels: { style: { colors: '#a89685' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { style: { colors: '#a89685' } } },
    tooltip: { theme: 'light' },
  }

  const series = [
    { name: 'Kỳ này', data: data.current },
    { name: 'Kỳ trước', data: data.previous },
  ]

  return (
    <div className="dash-card dash-card-wide">
      <div className="dash-card-head">
        <h3>Phân tích doanh thu</h3>
        <div className="metric-toggle">
          {METRICS.map((m) => (
            <button
              key={m.id}
              className={`metric-btn ${metric === m.id ? 'metric-btn-active' : ''}`}
              onClick={() => setMetric(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <span className="dash-tag">dữ liệu minh họa · so với kỳ trước</span>
      <Chart options={options} series={series} type="area" height={300} />
    </div>
  )
}
