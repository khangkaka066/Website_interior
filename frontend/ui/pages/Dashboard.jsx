'use client'

import { useEffect, useState } from 'react'
import { timeRanges } from '../data/dashboardDemo'
import { api } from '../api'
import AdminLayout from '../components/dashboard/AdminLayout'
import TodoList from '../components/dashboard/TodoList'
import KpiCards from '../components/dashboard/KpiCards'
import RevenueChart from '../components/dashboard/RevenueChart'
import { TopCategories, SuccessGauge, FunnelCard, StatusBars, ActivityFeed } from '../components/dashboard/OverviewCards'
import SellingProducts from '../components/dashboard/SellingProducts'
import PriceAlerts from '../components/dashboard/PriceAlerts'
import RecentOrders from '../components/dashboard/RecentOrders'
import { shopInfo } from '../data/shop'
import { rangeQuery } from '../utils/rangeQuery'

// Bố cục: thông báo (xóa được) → chỉ số → doanh thu + danh mục → vận hành → đơn gần đây + hoạt động → sản phẩm → cảnh báo ở cuối trang.
export default function Dashboard() {
  const [range, setRange] = useState('7d')
  const [overview, setOverview] = useState(null)
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  const [dates, setDates] = useState({ from: today, to: today })
  const setDate = (key, value) =>
    setDates((d) => {
      const next = { ...d, [key]: value }
      if (next.from && next.to && next.from > next.to) next[key === 'from' ? 'to' : 'from'] = value
      return next
    })

  useEffect(() => {
    let off = false
    api.get(`/analytics/overview?${rangeQuery(range, dates)}`).then((o) => !off && setOverview(o)).catch(() => !off && setOverview(null))
    return () => {
      off = true
    }
  }, [range, dates])

  const headerActions = (
    <div className="range-filter">
      {timeRanges.map((r) => (
        <button key={r.id} className={`range-btn ${range === r.id ? 'range-btn-active' : ''}`} onClick={() => setRange(r.id)}>
          {r.label}
        </button>
      ))}
      {range === 'custom' && (
        <span className="range-custom">
          <input type="date" aria-label="Từ ngày" value={dates.from} max={today} onChange={(e) => e.target.value && setDate('from', e.target.value)} />
          <span>–</span>
          <input type="date" aria-label="Đến ngày" value={dates.to} max={today} onChange={(e) => e.target.value && setDate('to', e.target.value)} />
        </span>
      )}
    </div>
  )

  return (
    <AdminLayout activeNav="overview" pageTitle="Tổng quan" headerActions={headerActions}>
      <TodoList />

      <KpiCards range={range} dates={dates} />

      <section className="dash-grid" id="analytics">
        <RevenueChart range={range} dates={dates} />
        <TopCategories overview={overview} />
      </section>

      <section className="dash-grid-3">
        <StatusBars />
        <FunnelCard range={range} dates={dates} />
        <SuccessGauge overview={overview} />
      </section>

      <section className="dash-grid" id="orders">
        <RecentOrders />
        <ActivityFeed />
      </section>

      <section className="dash-grid" id="products">
        <SellingProducts />
      </section>

      <section className="shop-strip">
        <span className="dash-tag dash-tag-real">dữ liệu thật từ Shopee</span>
        {shopInfo.stats.map((s) => (
          <div className="shop-strip-item" key={s.label}>
            <strong>{s.value}</strong>
            <span>{s.label}</span>
          </div>
        ))}
        <a className="shop-strip-link" href="https://shopee.vn/clevi.interior" target="_blank" rel="noreferrer">
          Xem shop trên Shopee →
        </a>
      </section>

      <section className="dash-grid pa-grid">
        <PriceAlerts />
      </section>
    </AdminLayout>
  )
}
