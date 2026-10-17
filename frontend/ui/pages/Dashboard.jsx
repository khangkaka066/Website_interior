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

const RANGE_API = { today: 'today', '7d': '7d', '30d': '30d', month: 'month', custom: '30d' }

// Bố cục: thông báo (xóa được) → chỉ số → doanh thu + danh mục → vận hành → đơn gần đây + hoạt động → sản phẩm → cảnh báo ở cuối trang.
export default function Dashboard() {
  const [range, setRange] = useState('7d')
  const [overview, setOverview] = useState(null)

  useEffect(() => {
    let off = false
    api.get(`/analytics/overview?range=${RANGE_API[range] || '30d'}`).then((o) => !off && setOverview(o)).catch(() => !off && setOverview(null))
    return () => {
      off = true
    }
  }, [range])

  const headerActions = (
    <div className="range-filter">
      {timeRanges.map((r) => (
        <button key={r.id} className={`range-btn ${range === r.id ? 'range-btn-active' : ''}`} onClick={() => setRange(r.id)}>
          {r.label}
        </button>
      ))}
    </div>
  )

  return (
    <AdminLayout activeNav="overview" pageTitle="Tổng quan" headerActions={headerActions}>
      <TodoList />

      <KpiCards range={range} />

      <section className="dash-grid" id="analytics">
        <RevenueChart range={range} />
        <TopCategories overview={overview} />
      </section>

      <section className="dash-grid-3">
        <StatusBars />
        <FunnelCard range={range} />
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
