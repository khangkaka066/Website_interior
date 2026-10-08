import { Link } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import WishlistButton from '../components/WishlistButton'
import { useProducts } from '../data/liveProducts'
import { useWishlist } from '../context/WishlistContext'
import { useSeo } from '../useSeo'

const formatPrice = (n) => n.toLocaleString('vi-VN') + 'đ'

export default function Wishlist() {
  useSeo({ title: 'Sản phẩm yêu thích', noindex: true })
  const products = useProducts()
  const { ids } = useWishlist()
  // Giữ thứ tự mới thêm lên đầu; sản phẩm đã ngừng bán thì tự bỏ khỏi danh sách hiển thị.
  const items = ids.map((id) => products.find((p) => p.id === id)).filter(Boolean)

  return (
    <>
      <Header />
      <main>
        <div className="container wishlist-page">
          <h1>Sản phẩm yêu thích</h1>
          {items.length === 0 ? (
            <div className="wishlist-empty">
              <p>Bạn chưa lưu sản phẩm nào. Bấm biểu tượng trái tim trên sản phẩm để lưu lại xem sau.</p>
              <Link to="/products" className="btn btn-accent">
                Xem sản phẩm
              </Link>
            </div>
          ) : (
            <div className="product-grid product-grid-all">
              {items.map((p) => (
                <Link className="product-card" key={p.id} to={`/products/${p.id}`}>
                  <div className="product-thumb">
                    <img src={p.image} alt={p.name} loading="lazy" />
                    <WishlistButton productId={p.id} />
                  </div>
                  <span className="product-type">{p.type}</span>
                  <h4>{p.name}</h4>
                  <div className="product-meta">
                    <span className="price">
                      {p.priceMax ? 'Từ ' : ''}
                      {formatPrice(p.price)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
