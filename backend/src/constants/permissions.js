// One row per manageable feature area a SUPPORT_ADMIN account can be
// granted access to. MAIN_ADMIN always has every permission and can flip
// these from the "Tài khoản & Phân quyền" admin page — "roles" itself is
// intentionally not on this list: changing account roles stays MAIN_ADMIN
// -only and can never be delegated, to avoid a support admin promoting
// themselves.
export const PERMISSION_DEFS = [
  { key: 'orders', label: 'Đơn hàng', defaultEnabled: true },
  { key: 'shipping', label: 'Vận chuyển', defaultEnabled: true },
  { key: 'customers', label: 'Khách hàng', defaultEnabled: true },
  { key: 'messages', label: 'Tin nhắn', defaultEnabled: true },
  { key: 'products', label: 'Sản phẩm (sửa/xóa)', defaultEnabled: false },
  { key: 'campaigns', label: 'Quảng cáo', defaultEnabled: false },
  { key: 'analytics', label: 'Báo cáo & Phân tích', defaultEnabled: false },
]

export const PERMISSION_KEYS = PERMISSION_DEFS.map((p) => p.key)
