// Khung nội dung cho các trang thông tin (Về chúng tôi, Liên hệ, FAQ). Header/Footer do layout của nhóm (shop) cung cấp,
// nên trang thông tin có cùng giao diện (menu, tìm kiếm, giỏ hàng, chat) với phần còn lại của website.
export default function SiteShell({ children }) {
  return <main className="tw-reset mx-auto w-full max-w-5xl px-4 py-10">{children}</main>
}
