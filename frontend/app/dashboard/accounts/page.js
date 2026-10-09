import { redirect } from 'next/navigation'

// Tài khoản & Phân quyền đã gộp vào Cài đặt.
export default function Page() {
  redirect('/dashboard/settings?tab=accounts')
}
