// Máy chủ Next gọi thẳng backend; trình duyệt gọi cùng địa chỉ (/api) và Next chuyển tiếp (xem rewrites trong next.config.mjs).
export const API_BASE =
  typeof window === 'undefined' ? process.env.BACKEND_URL || 'http://localhost:4000' : process.env.NEXT_PUBLIC_API_BASE_URL || ''

// Thông tin cửa hàng + nội dung Về chúng tôi / Liên hệ / FAQ (sửa ở dashboard > Cài đặt > Nội dung trang).
// Cache 60 giây: admin sửa xong tối đa 1 phút sau khách thấy.
export async function fetchSiteContent() {
  const res = await fetch(`${API_BASE}/api/shop/content`, { next: { revalidate: 60 } })
  if (!res.ok) throw new Error('Không tải được nội dung trang.')
  return res.json()
}
