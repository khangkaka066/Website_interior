// Khu quản trị không cho Google lập chỉ mục; quyền truy cập kiểm tra ở trình duyệt (token đăng nhập nằm trong localStorage)
// và ở backend cho từng API.
export const metadata = { title: 'Quản trị', robots: { index: false, follow: false } }

export default function DashboardLayout({ children }) {
  return children
}
