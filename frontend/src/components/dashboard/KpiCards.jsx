import { useEffect, useState } from 'react'
import { api } from '../../api'
import { formatCurrency } from '../../utils/format'
import {
  RevenueIcon,
  OrdersIcon,
  AovIcon,
  CustomersIcon,
  ConversionIcon,
  TrendUpIcon,
  TrendDownIcon,
} from './DashIcons'

const RANGE_API = { today: 'today', '7d': '7d', '30d': '30d', month: 'month', custom: '30d' }

// Số liệu thật từ đơn hàng / khách hàng / sự kiện truy cập; chưa có dữ liệu thì hiện 0.
export default function KpiCards({ range = '7d' }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    const r = RANGE_API[range] || '30d'
    Promise.all([
      api.get(`/analytics/overview?range=${r}`),
      api.get(`/analytics/funnel?range=${r}`),
      api.get('/customers?pageSize=1'),
    ])
      .then(([overview, funnel, customers]) => {
        if (cancelled) return
        const last = funnel.stages[funnel.stages.length - 1]
        setData({ overview, conversion: last?.rateFromFirst || 0, customers: customers.total || 0 })
      })
      .catch(() => !cancelled && setData(null))
    return () => {
      cancelled = true
    }
  }, [range])

  const o = data?.overview
  const kpis = [
    { id: 'revenue', label: 'Doanh thu', value: formatCurrency(o?.revenue || 0), change: o?.revenueChange, Icon: RevenueIcon },
    { id: 'orders', label: 'Đơn hàng', value: String(o?.orderCount || 0), change: o?.orderChange, Icon: OrdersIcon },
    { id: 'aov', label: 'Giá trị đơn TB (AOV)', value: formatCurrency(o?.aov || 0), change: null, Icon: AovIcon },
    { id: 'customers', label: 'Khách hàng', value: String(data?.customers || 0), change: null, Icon: CustomersIcon },
    { id: 'conversion', label: 'Tỷ lệ chuyển đổi', value: `${(data?.conversion || 0).toFixed(1)}%`, change: null, Icon: ConversionIcon },
  ]

  return (
    <section className="kpi-grid">
      {kpis.map(({ id, label, value, change, Icon }) => {
        const hasChange = typeof change === 'number'
        const positive = hasChange && change >= 0
        return (
          <div className="kpi-card" key={id}>
            <div className="kpi-card-top">
              <span className="kpi-icon">
                <Icon />
              </span>
              {hasChange && (
                <span className={`kpi-change ${positive ? 'kpi-up' : 'kpi-down'}`}>
                  {positive ? <TrendUpIcon /> : <TrendDownIcon />}
                  {Math.abs(change).toFixed(1)}%
                </span>
              )}
            </div>
            <strong className="kpi-value">{value}</strong>
            <span className="kpi-label">{label}</span>
          </div>
        )
      })}
    </section>
  )
}
