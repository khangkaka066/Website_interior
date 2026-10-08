import { useEffect } from 'react'
import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import Storefront from './pages/Storefront'
import AllProducts from './pages/AllProducts'
import PublicProductDetail from './pages/ProductDetail'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import OrderConfirmation from './pages/OrderConfirmation'
import TrackOrder from './pages/TrackOrder'
import ResetPassword from './pages/ResetPassword'
import Wishlist from './pages/Wishlist'
import { trackEvent } from './analytics'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import RequireAdmin from './components/RequireAdmin'
import RequirePermission from './components/RequirePermission'
import ProductList from './pages/admin/ProductList'
import ProductForm from './pages/admin/ProductForm'
import ProductDetail from './pages/admin/ProductDetail'
import OrderList from './pages/admin/OrderList'
import OrderDetail from './pages/admin/OrderDetail'
import ShippingDashboard from './pages/admin/ShippingDashboard'
import ShippingDetail from './pages/admin/ShippingDetail'
import CarrierSettings from './pages/admin/CarrierSettings'
import CustomerList from './pages/admin/CustomerList'
import CustomerDetail from './pages/admin/CustomerDetail'
import MessagesInbox from './pages/admin/MessagesInbox'
import CampaignList from './pages/admin/CampaignList'
import CampaignDetail from './pages/admin/CampaignDetail'
import AnalyticsDashboard from './pages/admin/AnalyticsDashboard'
import PaymentsAdmin from './pages/admin/PaymentsAdmin'
import SettingsAdmin from './pages/admin/SettingsAdmin'
import ChatWidget from './components/ChatWidget'

function guarded(permKey, element) {
  return (
    <RequireAdmin>
      <RequirePermission permKey={permKey}>{element}</RequirePermission>
    </RequireAdmin>
  )
}

export default function App() {
  const location = useLocation()
  const isDashboard = location.pathname.startsWith('/dashboard')

  useEffect(() => {
    if (!location.hash) window.scrollTo(0, 0)
  }, [location.pathname])

  useEffect(() => {
    if (!isDashboard) trackEvent('PAGE_VIEW')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  return (
    <>
    <Routes>
      <Route path="/" element={<Storefront />} />
      <Route path="/products" element={<AllProducts />} />
      <Route path="/products/:id" element={<PublicProductDetail />} />
      <Route path="/cart" element={<Cart />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/order-confirmation/:orderNumber" element={<OrderConfirmation />} />
      <Route path="/wishlist" element={<Wishlist />} />
      <Route path="/track-order" element={<TrackOrder />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ResetPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/dashboard"
        element={
          <RequireAdmin>
            <Dashboard />
          </RequireAdmin>
        }
      />
      <Route path="/dashboard/products" element={guarded('products', <ProductList />)} />
      <Route path="/dashboard/products/new" element={guarded('products', <ProductForm />)} />
      <Route path="/dashboard/products/:id/edit" element={guarded('products', <ProductForm />)} />
      <Route path="/dashboard/products/:id" element={guarded('products', <ProductDetail />)} />
      <Route path="/dashboard/orders" element={guarded('orders', <OrderList />)} />
      <Route path="/dashboard/orders/:id" element={guarded('orders', <OrderDetail />)} />
      <Route path="/dashboard/shipping" element={guarded('shipping', <ShippingDashboard />)} />
      <Route path="/dashboard/shipping/carriers" element={guarded('shipping', <CarrierSettings />)} />
      <Route path="/dashboard/shipping/:id" element={guarded('shipping', <ShippingDetail />)} />
      <Route path="/dashboard/customers" element={guarded('customers', <CustomerList />)} />
      <Route path="/dashboard/customers/:id" element={guarded('customers', <CustomerDetail />)} />
      <Route path="/dashboard/messages" element={guarded('messages', <MessagesInbox />)} />
      <Route path="/dashboard/campaigns" element={guarded('campaigns', <CampaignList />)} />
      <Route path="/dashboard/campaigns/:id" element={guarded('campaigns', <CampaignDetail />)} />
      <Route path="/dashboard/analytics" element={guarded('analytics', <AnalyticsDashboard />)} />
      <Route path="/dashboard/payments" element={guarded('payments', <PaymentsAdmin />)} />
      <Route
        path="/dashboard/settings"
        element={
          <RequireAdmin>
            <RequirePermission mainAdminOnly>
              <SettingsAdmin />
            </RequirePermission>
          </RequireAdmin>
        }
      />
      {/* Tài khoản & Phân quyền đã gộp vào Cài đặt */}
      <Route path="/dashboard/accounts" element={<Navigate to="/dashboard/settings?tab=accounts" replace />} />
      <Route
        path="*"
        element={
          <div style={{ padding: '80px 20px', textAlign: 'center' }}>
            <h1>Không tìm thấy trang</h1>
            <p><a href="/">Về trang chủ</a></p>
          </div>
        }
      />
    </Routes>
    {!isDashboard && <ChatWidget />}
    </>
  )
}
