import Header from '@/ui/components/Header'
import Footer from '@/ui/components/Footer'
import ChatMount from '@/ui/components/ChatMount'
import { ProductsProvider } from '@/ui/data/liveProducts'
import { fetchProducts, slimProduct } from '@/lib/server'

// Khung của các trang khách: Header, Footer, khung chat, và danh sách sản phẩm thật lấy từ backend ngay ở máy chủ
// (HTML đầu tiên đã có sản phẩm cho Google và khách; trình duyệt tự làm mới sau đó).
export default async function ShopLayout({ children }) {
  const products = (await fetchProducts())?.map(slimProduct)
  return (
    <ProductsProvider initial={products}>
      <Header />
      {children}
      <Footer />
      <ChatMount />
    </ProductsProvider>
  )
}
