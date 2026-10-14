import AdminView from '@/ui/AdminView'

// Bàn giao cho hãng: biên bản theo hãng. Đường dẫn tĩnh nên được ưu tiên hơn /dashboard/shipping/[id].
export default function Page() {
  return <AdminView view="handover" perm="shipping" />
}
