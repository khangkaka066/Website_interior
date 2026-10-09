'use client'

import dynamic from 'next/dynamic'
import ClientOnly from './components/ClientOnly'
import { PageSpinner } from './components/PageLoading'
import RequireAdmin from './components/RequireAdmin'
import RequirePermission from './components/RequirePermission'

// Mọi trang quản trị chạy ở trình duyệt (đọc phiên đăng nhập và localStorage), kèm thư viện biểu đồ cần `window`.
const lazy = (loader) => dynamic(loader, { ssr: false, loading: () => <PageSpinner /> })

const VIEWS = {
  dashboard: lazy(() => import('./pages/Dashboard')),
  productList: lazy(() => import('./pages/admin/ProductList')),
  productForm: lazy(() => import('./pages/admin/ProductForm')),
  productDetail: lazy(() => import('./pages/admin/ProductDetail')),
  orderList: lazy(() => import('./pages/admin/OrderList')),
  orderDetail: lazy(() => import('./pages/admin/OrderDetail')),
  shippingDashboard: lazy(() => import('./pages/admin/ShippingDashboard')),
  carrierSettings: lazy(() => import('./pages/admin/CarrierSettings')),
  shippingDetail: lazy(() => import('./pages/admin/ShippingDetail')),
  customerList: lazy(() => import('./pages/admin/CustomerList')),
  customerDetail: lazy(() => import('./pages/admin/CustomerDetail')),
  messages: lazy(() => import('./pages/admin/MessagesInbox')),
  campaignList: lazy(() => import('./pages/admin/CampaignList')),
  campaignDetail: lazy(() => import('./pages/admin/CampaignDetail')),
  analytics: lazy(() => import('./pages/admin/AnalyticsDashboard')),
  payments: lazy(() => import('./pages/admin/PaymentsAdmin')),
  discounts: lazy(() => import('./pages/admin/DiscountsAdmin')),
  news: lazy(() => import('./pages/admin/NewsAdmin')),
  settings: lazy(() => import('./pages/admin/SettingsAdmin')),
}

// perm: khóa quyền của mục (support admin cần được cấp); mainAdminOnly: chỉ Main Admin.
export default function AdminView({ view, perm, mainAdminOnly }) {
  const View = VIEWS[view]
  const page = <View />
  return (
    <ClientOnly fallback={<PageSpinner />}>
      <RequireAdmin>
        {perm || mainAdminOnly ? (
          <RequirePermission permKey={perm} mainAdminOnly={mainAdminOnly}>
            {page}
          </RequirePermission>
        ) : (
          page
        )}
      </RequireAdmin>
    </ClientOnly>
  )
}
