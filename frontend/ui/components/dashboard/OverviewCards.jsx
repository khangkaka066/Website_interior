'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Link } from '@/lib/router'
import { api } from '../../api'
import { rangeQuery } from '../../utils/rangeQuery'
import { formatCurrency, formatDate } from '../../utils/format'
import { ORDER_STATUS } from '../../constants/orderStatus'

// Biểu đồ tròn / cột của trang Tổng quan (ApexCharts nạp muộn). Số liệu đều lấy từ đơn hàng và sự kiện truy cập thật.
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

const PALETTE = ['#946b08', '#d9ad3c', '#1e293b', '#64748b', '#cbd5e1', '#3aa0c9']
const PAY_LABEL = { COD: 'Thanh toán khi nhận hàng', 'Chuyển khoản': 'Chuyển khoản', PAYOS: 'PayOS' }

const short = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}tr` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n))

function Head({ title, children }) {
  return (
    <div className="dash-card-head">
      <h3>{title}</h3>
      {children}
    </div>
  )
}

// Doanh thu theo danh mục: biểu đồ tròn + chú thích.
export function TopCategories({ overview }) {
  const rows = (overview?.topCategories || []).slice(0, 5)
  const total = rows.reduce((s, r) => s + r.revenue, 0)
  return (
    <div className="dash-card">
      <Head title="Danh mục bán chạy" />
      {total === 0 ? (
        <p className="dash-empty-state">Chưa có doanh thu trong kỳ này.</p>
      ) : (
        <>
          <Chart
            type="donut"
            height={210}
            series={rows.map((r) => r.revenue)}
            options={{
              labels: rows.map((r) => r.name),
              colors: PALETTE,
              legend: { show: false },
              dataLabels: { enabled: false },
              stroke: { width: 3, colors: ['#fff'] },
              tooltip: { y: { formatter: (v) => formatCurrency(v) } },
              plotOptions: { pie: { donut: { size: '72%', labels: { show: true, name: { show: false }, value: { fontSize: '20px', fontWeight: 800, color: '#1e293b', formatter: (v) => short(+v) }, total: { show: true, showAlways: true, label: 'Tổng', formatter: () => short(total) } } } } },
            }}
          />
          <ul className="legend-list">
            {rows.map((r, i) => (
              <li key={r.id}>
                <i style={{ background: PALETTE[i] }} />
                <span>{r.name}</span>
                <strong>{Math.round((r.revenue / total) * 100)}%</strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

// Tỷ lệ đơn giao thành công (đã giao / đơn không hủy) dạng đồng hồ + cơ cấu thanh toán.
export function SuccessGauge({ overview }) {
  const [counts, setCounts] = useState(null)
  useEffect(() => {
    api.get('/orders/status-counts').then(setCounts).catch(() => setCounts({}))
  }, [])
  const delivered = counts?.DELIVERED || 0
  const closed = (counts?.CANCELLED || 0) + (counts?.RETURNED || 0)
  const base = delivered + closed
  const pct = base > 0 ? Math.round((delivered / base) * 100) : 0
  const pay = overview?.byPayment || []
  return (
    <div className="dash-card">
      <Head title="Đơn giao thành công" />
      <Chart
        type="radialBar"
        height={210}
        series={[pct]}
        options={{
          colors: ['#946b08'],
          labels: ['Thành công'],
          plotOptions: { radialBar: { startAngle: -110, endAngle: 110, hollow: { size: '62%' }, track: { background: '#f1f5f9', strokeWidth: '100%' }, dataLabels: { name: { offsetY: 22, color: '#475569', fontSize: '12px' }, value: { offsetY: -14, fontSize: '28px', fontWeight: 800, color: '#1e293b', formatter: (v) => `${v}%` } } } },
          stroke: { lineCap: 'round' },
        }}
      />
      <p className="gauge-note">{delivered} đã giao · {closed} hủy / trả hàng</p>
      {pay.length > 0 && (
        <ul className="legend-list">
          {pay.map((p, i) => (
            <li key={p.method}>
              <i style={{ background: PALETTE[i] }} />
              <span>{PAY_LABEL[p.method] || p.method}</span>
              <strong>{p.orders} đơn</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Phễu chuyển đổi: các bậc cột giảm dần từ lượt xem đến mua hàng.
export function FunnelCard({ range, dates }) {
  const [stages, setStages] = useState(null)
  useEffect(() => {
    let off = false
    api.get(`/analytics/funnel?${rangeQuery(range, dates)}`).then((r) => !off && setStages(r.stages)).catch(() => !off && setStages([]))
    return () => {
      off = true
    }
  }, [range, dates])
  const max = Math.max(1, ...(stages || []).map((s) => s.count))
  return (
    <div className="dash-card">
      <Head title="Tỷ lệ chuyển đổi" />
      {stages && stages.every((s) => s.count === 0) ? (
        <p className="dash-empty-state">Chưa có lượt truy cập trong kỳ này.</p>
      ) : (
        <div className="funnel-bars">
          {(stages || []).map((s) => (
            <div className="funnel-col" key={s.key}>
              <strong>{s.count}</strong>
              <div className="funnel-bar" style={{ height: `${Math.max(6, (s.count / max) * 100)}%` }} />
              <span>{s.label}</span>
              <small>{s.rateFromFirst.toFixed(1)}%</small>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Tình trạng đơn hàng: thanh tiến độ theo từng trạng thái.
const STATUS_COLORS = { PENDING_CONFIRMATION: '#94a3b8', CONFIRMED: '#3aa0c9', PROCESSING: '#6cb7d6', AWAITING_SHIPMENT: '#d9ad3c', SHIPPING: '#946b08', DELIVERED: '#3e8e4f', CANCELLED: '#d14343', RETURNED: '#7a5806' }
export function StatusBars() {
  const [counts, setCounts] = useState(null)
  useEffect(() => {
    api.get('/orders/status-counts').then(setCounts).catch(() => setCounts({}))
  }, [])
  const rows = Object.keys(ORDER_STATUS).map((k) => ({ id: k, label: ORDER_STATUS[k].label, n: counts?.[k] || 0 }))
  const total = rows.reduce((s, r) => s + r.n, 0)
  const max = Math.max(1, ...rows.map((r) => r.n))
  return (
    <div className="dash-card">
      <Head title="Tình trạng đơn hàng">{counts && <span className="dash-tag">{total} đơn</span>}</Head>
      {counts && total === 0 && <p className="dash-empty-state">Chưa có đơn hàng nào.</p>}
      <div className="order-status-list">
        {rows.map((r) => (
          <div className="order-status-row" key={r.id}>
            <div className="order-status-label">
              <span>{r.label}</span>
              <strong>{r.n}</strong>
            </div>
            <div className="order-status-track">
              <div className="order-status-fill" style={{ width: `${(r.n / max) * 100}%`, background: STATUS_COLORS[r.id] }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const ACTION_TEXT = {
  confirm_order: 'đã được xác nhận',
  reviewed: 'nhận đánh giá từ khách',
  create_shipment: 'đã tạo vận đơn',
  prepare: 'đang chuẩn bị hàng',
}
const actionText = (a) => ACTION_TEXT[a] || (a.startsWith('status_') ? `chuyển sang "${ORDER_STATUS[a.slice(7).toUpperCase()]?.label || a.slice(7)}"` : a.replaceAll('_', ' '))

// Hoạt động gần đây của các đơn hàng.
export function ActivityFeed() {
  const [items, setItems] = useState(null)
  useEffect(() => {
    api.get('/orders/activity?limit=8').then((r) => setItems(r.items)).catch(() => setItems([]))
  }, [])
  return (
    <div className="dash-card">
      <Head title="Hoạt động gần đây" />
      {items && items.length === 0 && <p className="dash-empty-state">Chưa có hoạt động nào.</p>}
      <ul className="activity-list">
        {(items || []).map((a) => (
          <li key={a.id}>
            <i aria-hidden="true" />
            <div>
              <p>
                Đơn <Link to={`/dashboard/orders/${a.order.id}`}>{a.order.orderNumber}</Link> {actionText(a.action)}
              </p>
              <small>{formatDate(a.createdAt)}{a.actor ? ` · ${a.actor}` : ''}</small>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
