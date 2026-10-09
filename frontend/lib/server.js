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
