import { ShopSkeleton } from '@/ui/components/PageLoading'

// Hiện ngay khi chuyển tới trang đang lấy dữ liệu (sản phẩm, tin tức...): Header và Footer của layout giữ nguyên, chỉ phần nội dung có khung chờ.
export default function Loading() {
  return <ShopSkeleton />
}
