import { useState } from 'react'
import { timeRanges } from '../data/dashboardDemo'
import AdminLayout from '../components/dashboard/AdminLayout'
import KpiCards from '../components/dashboard/KpiCards'
import RevenueChart from '../components/dashboard/RevenueChart'
import OrderOverview from '../components/dashboard/OrderOverview'
import TopProducts from '../components/dashboard/TopProducts'
import InventoryAlerts from '../components/dashboard/InventoryAlerts'
import CustomerOverview from '../components/dashboard/CustomerOverview'
import SalesByCategory from '../components/dashboard/SalesByCategory'
import ConversionFunnel from '../components/dashboard/ConversionFunnel'
import RecentOrders from '../components/dashboard/RecentOrders'
import AiInsights from '../components/dashboard/AiInsights'
import { shopInfo } from '../data/shop'

export default function Dashboard() {
  const [range, setRange] = useState('7d')

  const headerActions = (
    <div className="range-filter">
      {timeRanges.map((r) => (
        <button
          key={r.id}
          className={`range-btn ${range === r.id ? 'range-btn-active' : ''}`}
          onClick={() => setRange(r.id)}
        >
          {r.label}
        </button>
      ))}
    </div>
  )

  return (
    <AdminLayout activeNav="overview" pageTitle="Tổng quan" headerActions={headerActions}>

      <section className="shop-strip">
        <span className="dash-tag dash-tag-real">dữ liệu thật từ Shopee</span>
        {shopInfo.stats.map((s) => (
          <div className="shop-strip-item" key={s.label}>
            <strong>{s.value}</strong>
            <span>{s.label}</span>
          </div>
        ))}
        <a
          className="shop-strip-link"
          href="https://shopee.vn/clevi.interior"
          target="_blank"
          rel="noreferrer"
        >
          Xem shop trên Shopee →
        </a>
      </section>

      <KpiCards />

      <section className="dash-grid" id="analytics">
        <RevenueChart />
        <OrderOverview />
      </section>

      <section className="dash-grid" id="products">
        <TopProducts />
        <InventoryAlerts />
      </section>

      <section className="dash-grid dash-grid-even" id="customers">
        <CustomerOverview />
        <SalesByCategory />
      </section>

      <ConversionFunnel />

      <div id="orders">
        <RecentOrders />
      </div>

      <AiInsights />
    </AdminLayout>
  )
}
