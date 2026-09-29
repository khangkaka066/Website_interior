import { kpis } from '../../data/dashboardDemo'
import {
  RevenueIcon,
  OrdersIcon,
  AovIcon,
  CustomersIcon,
  ConversionIcon,
  TrendUpIcon,
  TrendDownIcon,
} from './DashIcons'

const ICONS = {
  revenue: RevenueIcon,
  orders: OrdersIcon,
  aov: AovIcon,
  customers: CustomersIcon,
  conversion: ConversionIcon,
}

export default function KpiCards() {
  return (
    <section className="kpi-grid">
      {kpis.map((kpi) => {
        const Icon = ICONS[kpi.icon]
        const positive = kpi.change >= 0
        return (
          <div className="kpi-card" key={kpi.id}>
            <div className="kpi-card-top">
              <span className="kpi-icon">
                <Icon />
              </span>
              <span className={`kpi-change ${positive ? 'kpi-up' : 'kpi-down'}`}>
                {positive ? <TrendUpIcon /> : <TrendDownIcon />}
                {Math.abs(kpi.change)}%
              </span>
            </div>
            <strong className="kpi-value">{kpi.value}</strong>
            <span className="kpi-label">{kpi.label}</span>
          </div>
        )
      })}
    </section>
  )
}
