import { useEffect, useState } from 'react'
import Chart from 'react-apexcharts'
import { api } from '../../api'

const RANGE_API = { today: 'today', '7d': '7d', '30d': '30d', month: 'month', custom: '30d' }

const METRICS = [
  { id: 'revenue', label: 'Doanh thu', unit: 'tr đ' },
  { id: 'orders', label: 'Số đơn hàng', unit: 'đơn' },
]

export default function RevenueChart({ range = '7d' }) {
  const [metric, setMetric] = useState('revenue')
  const [trend, setTrend] = useState([])

  useEffect(() => {
    let cancelled = false
    api
      .get(`/analytics/overview?range=${RANGE_API[range] || '30d'}`)
      .then((r) => !cancelled && setTrend(r.trend || []))
      .catch(() => !cancelled && setTrend([]))
    return () => {
      cancelled = true
    }
  }, [range])

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
    legend: { show: false, labels: { colors: '#7a6f68' }, markers: { radius: 4 } },
    xaxis: {
      categories: trend.map((t) => t.label),
      labels: { style: { colors: '#a89685' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { style: { colors: '#a89685' } } },
    tooltip: { theme: 'light' },
  }

  const series = [{ name: metric === 'revenue' ? 'Doanh thu (triệu đ)' : 'Số đơn', data: trend.map((t) => (metric === 'revenue' ? +(t.revenue / 1e6).toFixed(2) : t.orders)) }]

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
      <span className="dash-tag dash-tag-real">dữ liệu thật · theo ngày</span>
      <Chart options={options} series={series} type="area" height={300} />
    </div>
  )
}
