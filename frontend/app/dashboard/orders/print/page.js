import AdminView from '@/ui/AdminView'

// Trang in phiếu đơn hàng: /dashboard/orders/print?ids=id1,id2 (đường dẫn tĩnh nên được ưu tiên hơn /dashboard/orders/[id]).
export default function Page() {
  return <AdminView view="orderPrint" perm="orders" />
}
