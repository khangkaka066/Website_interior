import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Storefront from './pages/Storefront'
import AllProducts from './pages/AllProducts'
import PublicProductDetail from './pages/ProductDetail'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import OrderConfirmation from './pages/OrderConfirmation'
import { trackEvent } from './analytics'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import RequireAdmin from './components/RequireAdmin'
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
import ChatWidget from './components/ChatWidget'

export default function App() {
  const location = useLocation()
  const isDashboard = location.pathname.startsWith('/dashboard')

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
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <RequireAdmin>
            <Dashboard />
          </RequireAdmin>
        }
      />
      <Route
        path="/dashboard/products"
        element={
          <RequireAdmin>
            <ProductList />
          </RequireAdmin>
        }
      />
      <Route
        path="/dashboard/products/new"
        element={
          <RequireAdmin>
            <ProductForm />
          </RequireAdmin>
        }
      />
      <Route
        path="/dashboard/products/:id/edit"
        element={
          <RequireAdmin>
            <ProductForm />
          </RequireAdmin>
        }
      />
      <Route
        path="/dashboard/products/:id"
        element={
          <RequireAdmin>
            <ProductDetail />
          </RequireAdmin>
        }
      />
      <Route
        path="/dashboard/orders"
        element={
          <RequireAdmin>
            <OrderList />
          </RequireAdmin>
        }
      />
      <Route
        path="/dashboard/orders/:id"
        element={
          <RequireAdmin>
            <OrderDetail />
          </RequireAdmin>
        }
      />
      <Route
        path="/dashboard/shipping"
        element={
          <RequireAdmin>
            <ShippingDashboard />
          </RequireAdmin>
        }
      />
      <Route
        path="/dashboard/shipping/carriers"
        element={
          <RequireAdmin>
            <CarrierSettings />
          </RequireAdmin>
        }
      />
      <Route
        path="/dashboard/shipping/:id"
        element={
          <RequireAdmin>
            <ShippingDetail />
          </RequireAdmin>
        }
      />
      <Route
        path="/dashboard/customers"
        element={
          <RequireAdmin>
            <CustomerList />
          </RequireAdmin>
        }
      />
      <Route
        path="/dashboard/customers/:id"
        element={
          <RequireAdmin>
            <CustomerDetail />
          </RequireAdmin>
        }
      />
      <Route
        path="/dashboard/messages"
        element={
          <RequireAdmin>
            <MessagesInbox />
          </RequireAdmin>
        }
      />
      <Route
        path="/dashboard/campaigns"
        element={
          <RequireAdmin>
            <CampaignList />
          </RequireAdmin>
        }
      />
      <Route
        path="/dashboard/campaigns/:id"
        element={
          <RequireAdmin>
            <CampaignDetail />
          </RequireAdmin>
        }
      />
      <Route
        path="/dashboard/analytics"
        element={
          <RequireAdmin>
            <AnalyticsDashboard />
          </RequireAdmin>
        }
      />
    </Routes>
    {!isDashboard && <ChatWidget />}
    </>
  )
}
