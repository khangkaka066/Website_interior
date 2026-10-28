'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { api } from '../../api'
import { rangeQuery } from '../../utils/rangeQuery'

// Thư viện biểu đồ khá nặng: tải sau khi trang đã hiện để số liệu và menu hiện ra trước.
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

const METRICS = [
  { id: 'revenue', label: 'Doanh thu', unit: 'tr đ' },
  { id: 'orders', label: 'Số đơn hàng', unit: 'đơn' },
]

export default function RevenueChart({ range = '7d', dates }) {
  const [metric, setMetric] = useState('revenue')
  const [trend, setTrend] = useState([])

  useEffect(() => {
    let cancelled = false
    api
      .get(`/analytics/overview?${rangeQuery(range, dates)}`)
      .then((r) => !cancelled && setTrend(r.trend || []))
      .catch(() => !cancelled && setTrend([]))
    return () => {
      cancelled = true
    }
  }, [range, dates])

  const options = {
    chart: { type: 'area', toolbar: { show: false } },
    colors: ['#946b08', '#e0c9b8'],
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: [3, 2], dashArray: [0, 4] },
    fill: {
      type: 'gradient',
      gradient: { shadeIntensity: 1, opacityFrom: 0.28, opacityTo: 0, stops: [0, 90, 100] },
    },
    grid: { borderColor: '#e5e7eb' },
    legend: { show: false, labels: { colors: '#64748b' }, markers: { radius: 4 } },
    xaxis: {
      categories: trend.map((t) => t.label),
      // Trục chỉ hiện vài mốc; ngày cụ thể xem ở tooltip khi rê chuột.
      tickAmount: Math.min(Math.max(trend.length - 1, 1), 6),
      labels: { style: { colors: '#94a3b8' }, rotate: 0, hideOverlappingLabels: true },
      tooltip: { enabled: false },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { style: { colors: '#94a3b8' } } },
    tooltip: { theme: 'light', x: { show: true } },
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
