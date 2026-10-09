// Gọi backend từ máy chủ Next (Server Component). Trình duyệt thì gọi qua /api (xem rewrites trong next.config.mjs).
export const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000'

async function get(path, revalidate) {
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, { next: { revalidate }, signal: AbortSignal.timeout(4000) })
    return res.ok ? await res.json() : null
  } catch {
    return null // backend tắt/chậm: caller dùng dữ liệu đóng gói sẵn
  }
}

// Danh sách sản phẩm đang bán, làm mới tối đa 30 giây một lần (admin nhập Excel/sửa giá xong khách thấy nhanh).
export const fetchProducts = () => get('/api/shop/products', 30)
export const fetchProduct = (id) => get(`/api/shop/products/${encodeURIComponent(id)}`, 30)
// Tin tức: làm mới tối đa 10 giây một lần (bài mới đăng/gỡ xuống khách thấy nhanh).
export const fetchPosts = () => get('/api/shop/posts', 10)
export const fetchPost = (slug) => get(`/api/shop/posts/${encodeURIComponent(slug)}`, 10)

// Bản rút gọn của sản phẩm để nhúng vào HTML mọi trang (thẻ sản phẩm, menu, tìm nhanh): bỏ mô tả, phân loại, ảnh phụ.
// Danh sách đầy đủ (~560KB) trước đây bị nhúng vào TỪNG trang (kể cả Giới thiệu, Tin tức), làm HTML nặng ~640KB, chậm tải và tốn
// ngân sách thu thập của Google. Trình duyệt tự tải bản đầy đủ ngay sau khi mở trang (xem ProductsProvider); trang chi tiết sản phẩm
// nhận sản phẩm đầy đủ riêng từ máy chủ nên nội dung cho Google vẫn đủ.
export const slimProduct = (p) => ({
  id: p.id,
  shopeeId: p.shopeeId,
  name: p.name,
  price: p.price,
  ...(p.priceMax && { priceMax: p.priceMax }),
  ...(p.originalPrice && { originalPrice: p.originalPrice, discountPercent: p.discountPercent }),
  image: p.image,
  categoryId: p.categoryId,
  type: p.type,
  sold: p.sold,
  createdAt: p.createdAt,
})
