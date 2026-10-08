// Trang đứng riêng không có Header/Footer (đăng nhập, quên mật khẩu).
export const metadata = { robots: { index: false, follow: false } }

export default function BareLayout({ children }) {
  return children
}
