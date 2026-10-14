import AdminView from '@/ui/AdminView'

// Đóng gói: quét mã vạch trên tem. Đường dẫn tĩnh nên được ưu tiên hơn /dashboard/orders/[id].
export default function Page() {
  return <AdminView view="packScan" perm="orders" />
}
