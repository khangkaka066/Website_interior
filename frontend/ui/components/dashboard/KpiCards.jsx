'use client'

import { useEffect, useState } from 'react'
import { api } from '../../api'
import { formatCurrency } from '../../utils/format'
import { rangeQuery } from '../../utils/rangeQuery'
import {
  RevenueIcon,
  OrdersIcon,
  AovIcon,
  CustomersIcon,
  ConversionIcon,
  TrendUpIcon,
  TrendDownIcon,
} from './DashIcons'

// Số liệu thật từ đơn hàng / khách hàng / sự kiện truy cập; chưa có dữ liệu thì hiện 0.
export default function KpiCards({ range = '7d', dates }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    const r = rangeQuery(range, dates)
    Promise.all([
      api.get(`/analytics/overview?${r}`),
      api.get(`/analytics/funnel?${r}`),
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
  }, [range, dates])

  const o = data?.overview
  const kpis = [
    { id: 'revenue', label: 'Doanh thu', value: formatCurrency(o?.revenue || 0), change: o?.revenueChange, Icon: RevenueIcon },
    { id: 'revenue-actual', label: 'Doanh thu thực tế (đã hoàn thành)', value: formatCurrency(o?.revenueActual || 0), change: null, Icon: RevenueIcon },
    { id: 'revenue-pending', label: 'Doanh thu tạm tính (chờ hết hạn đổi trả)', value: formatCurrency(o?.revenuePending || 0), change: null, Icon: RevenueIcon },
    { id: 'orders', label: 'Đơn hàng', value: String(o?.orderCount || 0), change: o?.orderChange, Icon: OrdersIcon },
    { id: 'aov', label: 'Giá trị đơn TB (AOV)', value: formatCurrency(o?.aov || 0), change: null, Icon: AovIcon },
    { id: 'customers', label: 'Khách hàng', value: String(data?.customers || 0), change: null, Icon: CustomersIcon },
  ]

  return (
    <section className="kpi-grid">
      {kpis.map(({ id, label, value, change, Icon }) => {
        const hasChange = typeof change === 'number'
        const positive = hasChange && change >= 0
        return (
          <div className={`kpi-card${id === 'revenue' ? ' kpi-card-hero' : ''}`} key={id}>
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
